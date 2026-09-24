# Security

Do not expose core fetching to untrusted URLs from a server with access to private services unless outbound network policy blocks those services. The URL guard checks hostnames and literal IPs; it does not resolve DNS or pin addresses, so DNS rebinding and public hostnames resolving to private addresses are not prevented here.

Never render extracted text as HTML. Embeds and HTML sanitization are not provided. Apply the same outbound policy before fetching returned image or favicon URLs. Configure API_KEY and request limits when deploying a public Worker.

Report vulnerabilities privately to the repository owner. A dedicated security reporting channel will be configured before public release; avoid public issues containing exploitable details.
