export default {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/video-convite': ['./assets/video_chunks/**/*']
  },
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests" }
    ];
    // Camera is allowed only on the authenticated staff entrance route.
    const scannerHeaders=common.map(h=>h.key==='Permissions-Policy'?
      {...h,value:'camera=(self), microphone=(), geolocation=()'}:h);
    return [
      {source:'/:path*',headers:common},
      {source:'/operacao/portaria',headers:scannerHeaders},
      {source:'/operacao/geral',headers:scannerHeaders},
      {source:'/operacao/caixa',headers:scannerHeaders}
    ];
  }
};
