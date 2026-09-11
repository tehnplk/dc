import { createRemoteJWKSet, jwtVerify } from 'jose'

// PLKHealth SSO — https://sso.plkhealth.go.th/llm.txt
// confidential client: มี secret จึงไม่ต้องใช้ PKCE ก็ได้ แต่ส่งไปด้วยไม่เสียหาย
// และช่วยกันเคส authorization code ถูกดักระหว่าง redirect
export const ISSUER = process.env.SSO_ISSUER ?? 'https://sso.plkhealth.go.th'
const CLIENT_ID = process.env.SSO_CLIENT_ID!
const CLIENT_SECRET = process.env.SSO_CLIENT_SECRET!

export function redirectUri() {
  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/auth/callback`
}

type Discovery = {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
  issuer: string
}

// เอกสารบอกให้อ่าน discovery ไม่ให้ hard-code endpoint — แคชไว้ในหน่วยความจำของ process
let cached: Promise<Discovery> | null = null
export function discover(): Promise<Discovery> {
  cached ??= fetch(`${ISSUER}/.well-known/openid-configuration`).then((r) => {
    if (!r.ok) throw new Error(`discovery ${r.status}`)
    return r.json() as Promise<Discovery>
  })
  return cached
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export async function authorizeUrl(p: { state: string; nonce: string; challenge: string }) {
  const d = await discover()
  const u = new URL(d.authorization_endpoint)
  u.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    // ไม่ขอ scope cid แล้ว: เลขบัตรรับจากผู้ใช้กรอกเองตอนตั้งค่าบัญชี ไม่ต้องให้ SSO ส่งมา
    scope: process.env.SSO_SCOPES ?? 'openid profile email organization',
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
  }).toString()
  return u.toString()
}

export type SsoProfile = {
  sub: string
  name?: string
  email?: string
  provider_id?: string
  hoscode?: string
  hname?: string
  position?: string
}

/** แลก code เป็น token → ตรวจ id_token → ดึง userinfo */
export async function exchange(code: string, verifier: string, nonce: string): Promise<SsoProfile> {
  const d = await discover()

  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // client_secret_basic — เอกสารห้ามส่งสองวิธีพร้อมกัน จึงไม่ใส่ client_secret ใน body
      authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`token ${res.status} ${(await res.text()).slice(0, 200)}`)
  const tok = (await res.json()) as { access_token: string; id_token?: string }

  let claims: Record<string, unknown> = {}
  if (tok.id_token) {
    // ตรวจลายเซ็น + iss + aud + exp ด้วย JWKS ที่ประกาศไว้ ไม่ใช่แค่ decode
    jwks ??= createRemoteJWKSet(new URL(d.jwks_uri))
    const v = await jwtVerify(tok.id_token, jwks, { issuer: d.issuer, audience: CLIENT_ID })
    if (v.payload.nonce !== nonce) throw new Error('nonce ไม่ตรง')
    claims = v.payload as Record<string, unknown>
  }

  // userinfo ให้ claim ของ scope organization (hoscode/hname/position) ที่ต้องใช้ผูกหน่วยงาน
  const ui = await fetch(d.userinfo_endpoint, {
    headers: { authorization: `Bearer ${tok.access_token}` },
  })
  if (!ui.ok) throw new Error(`userinfo ${ui.status}`)
  const info = (await ui.json()) as Record<string, unknown>

  const merged = { ...claims, ...info }

  // discovery ประกาศ claim ไว้ชุดหนึ่ง แต่ IdP อาจส่งมาเกินนั้น
  // log แค่ "ชื่อฟิลด์" ไม่ log ค่า จะได้รู้ว่ามีอะไรให้ใช้เพิ่มโดยไม่เอา PII ลง log
  const known = new Set(['sub','iss','aud','exp','iat','nonce','auth_time',
    'provider_id','name','email','hoscode','hname','position','cid_hash','hash_cid'])
  const extra = Object.keys(merged).filter((k) => !known.has(k))
  if (extra.length) console.info('sso: claim นอกเหนือจาก discovery →', extra.join(', '))
  const str = (k: string) => (typeof merged[k] === 'string' ? (merged[k] as string) : undefined)
  const sub = str('sub')
  if (!sub) throw new Error('ไม่มี sub')
  return {
    sub,
    name: str('name'),
    email: str('email'),
    provider_id: str('provider_id'),
    hoscode: str('hoscode'),
    hname: str('hname'),
    position: str('position'),
  }
}
