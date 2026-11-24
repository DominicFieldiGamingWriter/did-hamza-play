import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function validSecret(s: string, e: string) { const a=Buffer.from(s), b=Buffer.from(e); return a.length===b.length && timingSafeEqual(a,b); }
function textValue(v: unknown, max: number): string|null { return typeof v==="string" && v.trim() ? v.trim().slice(0,max) : null; }
function intValue(v: unknown, min=0, max=Number.MAX_SAFE_INTEGER): number|null { const n=Number(v); return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null; }
function timestamp(v: unknown): string { return typeof v==="string"&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():new Date().toISOString(); }
export async function POST(request: Request) {
  const expected=process.env.BSD_USAGE_INGEST_SECRET??"", auth=request.headers.get("authorization")??"", supplied=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!expected||!validSecret(supplied,expected)) return NextResponse.json({ok:false},{status:401});
  let payload:any; try { payload=await request.json(); } catch { return NextResponse.json({ok:false,error:"Invalid JSON."},{status:400}); }
  if(!payload||payload.record?.site!=="ben") return NextResponse.json({ok:false,error:"Invalid usage record."},{status:400});
  const r=payload.record, admin=getSupabaseAdmin();
  if(payload.kind==="api_request") {
    const outcome=["success","http_error","network_error"].includes(r.outcome)?r.outcome:null, endpoint=textValue(r.endpoint,140);
    if(!outcome||!endpoint) return NextResponse.json({ok:false,error:"Invalid API event."},{status:400});
    const {error}=await admin.from("bsd_api_usage_events").insert({
      requested_at:timestamp(r.requested_at),site:"ben",endpoint,http_status:intValue(r.http_status,100,599),
      latency_ms:intValue(r.latency_ms,0,3600000)??0,outcome,provider_code:textValue(r.provider_code,100),
      rate_limit_limit:intValue(r.rate_limit_limit),rate_limit_remaining:intValue(r.rate_limit_remaining),
      rate_limit_reset_at:r.rate_limit_reset_at?timestamp(r.rate_limit_reset_at):null,
      job_type:textValue(r.job_type,50)??"full_refresh",fixture_id:intValue(r.fixture_id,1)
    });
    if(error){console.error("BSD_USAGE_INGEST_FAILED",error.message);return NextResponse.json({ok:false},{status:500});}
    return NextResponse.json({ok:true},{status:202});
  }
  if(payload.kind==="refresh_run") {
    const result=["success","skipped_rate_limited","error"].includes(r.result)?r.result:null;
    if(!result) return NextResponse.json({ok:false,error:"Invalid refresh event."},{status:400});
    const {error}=await admin.from("bsd_api_refresh_runs").insert({
      started_at:timestamp(r.started_at),finished_at:timestamp(r.finished_at),site:"ben",result,
      duration_ms:intValue(r.duration_ms,0,3600000)??0,provider_code:textValue(r.provider_code,100),
      job_type:textValue(r.job_type,50)??"full_refresh",fixture_id:intValue(r.fixture_id,1)
    });
    if(error){console.error("BSD_USAGE_INGEST_FAILED",error.message);return NextResponse.json({ok:false},{status:500});}
    return NextResponse.json({ok:true},{status:202});
  }
  return NextResponse.json({ok:false,error:"Unknown event type."},{status:400});
}
