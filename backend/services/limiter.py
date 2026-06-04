from slowapi import Limiter
from fastapi import Request

def safe_get_remote_address(request: Request) -> str:
    if request.client is None:
        return request.headers.get("x-forwarded-for", "127.0.0.1").split(",")[0]
    return request.client.host

# Uses the client IP address as the rate-limit key.
limiter = Limiter(key_func=safe_get_remote_address, default_limits=["200/minute"])
