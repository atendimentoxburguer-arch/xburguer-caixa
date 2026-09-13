import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const jsonHeaders={"Content-Type":"application/json","Cache-Control":"no-store"};

function reply(status:number,body:Record<string,unknown>){
  return new Response(JSON.stringify(body),{status,headers:jsonHeaders});
}

async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

function money(value:number){
  return Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function reminderTitle(days:number,supplier:string){
  const lead=days===0?"Vence hoje":days===1?"Vence amanhã":`Vence em ${days} dias`;
  return `${lead} • ${supplier||"Boleto"}`;
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});

  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
  const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!supabaseUrl||!serviceRole)return reply(500,{error:"server_not_configured"});

  const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:configRows,error:configError}=await db.rpc("get_bill_push_config");
  if(configError)return reply(500,{error:"push_config_unavailable",detail:configError.message});
  const config=Array.isArray(configRows)?configRows[0]:configRows;
  if(!config?.vapid_public_key||!config?.vapid_private_key||!config?.vapid_subject||!config?.cron_secret_hash){
    return reply(503,{error:"push_config_incomplete"});
  }

  const receivedSecret=req.headers.get("x-cron-secret")||"";
  const receivedHash=await sha256Hex(receivedSecret);
  if(!receivedSecret||receivedHash!==String(config.cron_secret_hash))return reply(401,{error:"unauthorized"});

  webpush.setVapidDetails(String(config.vapid_subject),String(config.vapid_public_key),String(config.vapid_private_key));

  const {data:targets,error:targetError}=await db.rpc("list_due_bill_notification_targets");
  if(targetError)return reply(500,{error:"target_query_failed",detail:targetError.message});

  let sent=0,disabled=0,failed=0;
  for(const target of targets||[]){
    const days=Number(target.reminder_days);
    const payload={
      title:reminderTitle(days,String(target.supplier||"Boleto")),
      body:`${money(Number(target.amount||0))}${target.description?` — ${String(target.description)}`:""}`,
      billId:target.bill_id,
      reminderDays:days,
      dueDate:target.due_date
    };

    try{
      await webpush.sendNotification({
        endpoint:String(target.endpoint),
        keys:{p256dh:String(target.p256dh),auth:String(target.auth)}
      },JSON.stringify(payload),{TTL:86400,urgency:days===0?"high":"normal"});

      const {error:logError}=await db.rpc("record_bill_notification",{
        p_bill_id:target.bill_id,
        p_subscription_id:target.subscription_id,
        p_due_date:target.due_date,
        p_reminder_days:days
      });
      if(logError)throw logError;
      sent++;
    }catch(error){
      const statusCode=Number((error as {statusCode?:number})?.statusCode||0);
      if(statusCode===404||statusCode===410){
        await db.from("bill_push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",target.subscription_id);
        disabled++;
      }else{
        failed++;
        console.error("bill-reminders push failed",target.subscription_id,error);
      }
    }
  }

  return reply(200,{ok:true,targets:(targets||[]).length,sent,disabled,failed});
});
