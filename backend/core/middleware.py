"""
Security middleware for adding HTTP security headers.
"""


class SecurityHeadersMiddleware:
    """
    Middleware to add security headers to all responses.
    These headers help protect against common web vulnerabilities.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'
        
        # Prevent clickjacking (already handled by Django's XFrameOptionsMiddleware,
        # but we set it explicitly for API responses)
        if 'X-Frame-Options' not in response:
            response['X-Frame-Options'] = 'DENY'
        
        # Enable XSS filter in older browsers
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer policy - don't leak referrer to other origins
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions policy - restrict browser features
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        # For HTTPS connections, add HSTS header
        # Note: Only add this if you're sure all traffic goes through HTTPS
        # if request.is_secure():
        #     response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response
