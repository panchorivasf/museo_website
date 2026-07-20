# Email forwarding for museobioacustico.org

The domain currently does not appear to have mail exchange records configured, so email forwarding is not active yet.

## What to configure

1. Open the DNS dashboard for the domain provider (Cloudflare, Namecheap, etc.).
2. Add the MX records shown by your mail provider for email routing/forwarding.
3. Add the SPF record recommended by the same provider.
4. Enable email routing and create forwarding addresses such as:
   - admin@museobioacustico.org -> your personal email
   - contacto@museobioacustico.org -> your personal email
5. Send a test email to confirm delivery.

## Recommended forwarding setup

Create forwarding rules like these:

- admin@museobioacustico.org -> admin personal email
- contacto@museobioacustico.org -> another personal email

## Verification

After the DNS changes are published, verify with:

- `nslookup -type=MX museobioacustico.org`
- sending a test email to one of the new aliases

If you are using Cloudflare Email Routing, the exact MX and TXT values will be generated inside the Cloudflare dashboard after enabling Email Routing.
