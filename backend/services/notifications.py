from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from requests.exceptions import ConnectionError, HTTPError

def send_push_notification(token: str, message: str, extra=None):
    try:
        response = PushClient().publish(
            PushMessage(to=token,
                        body=message,
                        data=extra)
        )
    except PushServerError as exc:
        print(f"PushServerError: {exc}")
    except (ConnectionError, HTTPError) as exc:
        print(f"ConnectionError/HTTPError: {exc}")
    except Exception as exc:
        print(f"Exception: {exc}")

def send_push_notifications(tokens: list[str], message: str, extra=None):
    messages = []
    for token in tokens:
        messages.append(PushMessage(to=token, body=message, data=extra))
    
    try:
        PushClient().publish_multiple(messages)
    except Exception as exc:
        print(f"Error sending push notifications: {exc}")
