# working script

import os
import sys
import uuid
import requests
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

# --- Debug: prove which file is running ---
print("=" * 60)
print("RUNNING FILE:", __file__)
print("=" * 60)

BASE_URL = os.environ["ATLASENT_BASE_URL"]
API_KEY  = os.environ["ATLASENT_API_KEY"]
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "apikey": ANON_KEY,
    "Content-Type": "application/json",
}

run_id = os.environ.get("GITHUB_RUN_ID") or str(uuid.uuid4())

eval_payload = {
    "action_type": "production.deploy",
    "actor_id": "agent:ci",
    "request_id": f"py-{run_id}",
    "context": {
        "environment": "prod",
        "approvals": 2,
        "change_window": True,
    },
}

# --- Guards: catch stale code ---
assert eval_payload["request_id"] != "py-local", "Stale request_id detected!"

# --- Debug: print exact outgoing payload ---
print("EVAL PAYLOAD:", eval_payload)

eval_resp = requests.post(f"{BASE_URL}/v1-evaluate", headers=headers, json=eval_payload)
eval_data = eval_resp.json()
print("EVAL RAW:", eval_data)

if eval_data.get("decision") != "allow":
    print(f"DENIED: {eval_data.get('deny_code', eval_data.get('reason'))}")
    sys.exit(1)

permit_token = eval_data.get("permit_token") or eval_data["permit"]["token"]

# --- Use the BINDING from the evaluation response ---
# The API key determines the bound environment (e.g. "test"),
# which may differ from context.environment. Always use the
# binding values returned by evaluate to avoid mismatches.
binding = eval_data.get("binding", {})
bound_env = binding.get("environment", eval_data.get("environment", "test"))
bound_fingerprint = binding.get("context_fingerprint") or eval_data.get("context_fingerprint")

print(f"BOUND ENVIRONMENT: {bound_env}")
print(f"BOUND FINGERPRINT: {bound_fingerprint}")

verify_payload = {
    "permit_token": permit_token,
    "action_type": binding.get("action_type", eval_payload["action_type"]),
    "actor_id": binding.get("actor_id", eval_payload["actor_id"]),
    "environment": bound_env,
    "context_fingerprint": bound_fingerprint,
}

# --- Debug: print exact verify payload ---
print("VERIFY PAYLOAD:", verify_payload)

verify_resp = requests.post(f"{BASE_URL}/v1-verify-permit", headers=headers, json=verify_payload)
verify_data = verify_resp.json()
print("VERIFY RAW:", verify_data)

if not verify_data.get("valid"):
    print(f"Permit FAILED: {verify_data.get('verify_error_code', verify_data.get('reason'))}")
    sys.exit(1)

print("✅ Permit verified — safe to deploy")
