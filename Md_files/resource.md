Knock Knock
Members 2/4. Share your team name so teammates can find and request to join.

Team key (header X-Team-Key)
Stored in `.env` as `A1MOBILE_TEAM_KEY`.
OpenAI key 1 (hackathon-007)
CHECK THE ENV FILE
Exhausted your budget? Get one more key
Members
Carl Okpala (you)
Jiyun Kim
1. Claim a phone number
curl -X POST https://hack.a1mobile.com/api/numbers/claim \
  -H "X-Team-Key: $A1MOBILE_TEAM_KEY"
# -> {"phone_number":"+1...","sip_username":"...","sip_password":"..."}
Wire that number to your agent two ways:

Webhook (recommended) — point the number's voice webhook at your public server; we stream the call to you (works with Pipecat / any server):
curl -X POST https://hack.a1mobile.com/api/numbers/point \
  -H "X-Team-Key: $A1MOBILE_TEAM_KEY" -H "Content-Type: application/json" \
  -d '{"webhook_url":"https://YOUR-SERVER/voice"}'
SIP — register the sip_username / sip_password at host sip.telnyx.com as a trunk (Vapi BYO SIP trunk, or LiveKit inbound trunk).
2. Verify a number, then call/text it
# send an OTP to the number you want to reach
curl -X POST https://hack.a1mobile.com/api/verified-numbers \
  -H "X-Team-Key: $A1MOBILE_TEAM_KEY" -H "Content-Type: application/json" \
  -d '{"phone":"+1NUMBER"}'
# confirm with the code that number receives
curl -X POST https://hack.a1mobile.com/api/verified-numbers/confirm \
  -H "X-Team-Key: $A1MOBILE_TEAM_KEY" -H "Content-Type: application/json" \
  -d '{"phone":"+1NUMBER","code":"123456"}'
# now send it a text
curl -X POST https://hack.a1mobile.com/api/sms \
  -H "X-Team-Key: $A1MOBILE_TEAM_KEY" -H "Content-Type: application/json" \
  -d '{"to":"+1NUMBER","body":"hello from my agent"}'
You may only call/text numbers you've OTP-verified (consent) or organizer test lines — no cold outreach.

3. Model key (AI gateway)
Your a1hk_ key gives $50 of inference across three models (openai.gpt-5.6-sol, -terra, -luna) via an OpenAI Responses endpoint (not chat/completions):

OPENAI_API_KEY=<your a1hk_ key above>
OPENAI_BASE_URL=https://h3zqfzovcybu5annkciuqf47mu0cbczd.lambda-url.us-east-2.on.aws/openai/v1
# POST https://h3zqfzovcybu5annkciuqf47mu0cbczd.lambda-url.us-east-2.on.aws/openai/v1/responses  (see AI_GATEWAY.md for a full example)
4. MCP
Same telephony tools for agents at https://hack.a1mobile.com/mcp/ (streamable HTTP — keep the trailing slash; pass your team_key to each tool): claim_number, point_number, send_confirmation_sms, request_number_verification, confirm_number_verification.
