# limiter.py — single shared slowapi Limiter instance.
# Defined here (not in main.py) so api routers can import it
# without causing a circular import through main.py.

# Import the Limiter class that tracks and enforces per-IP request limits
from slowapi import Limiter
# Import the helper function that extracts the caller's IP address from a request
from slowapi.util import get_remote_address

# Create one shared rate limiter instance that identifies clients by their IP address
limiter = Limiter(key_func=get_remote_address)
