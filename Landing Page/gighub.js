/* =============================================
   GIGHUB — Main JS (gighub.js)
   Shared across all pages
   ============================================= */

const GigHub = (() => {

  /* ── Logo SVG fallback ──────────────────────
     Used when GIGHUBLOGO ONLY.PNG isn't found   */
  function useFallbackLogo() {
    const img = document.getElementById('brandLogo');
    if (!img) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('width', '170');
    svg.setAttribute('height', '170');
    svg.classList.add('brand__logo');
    svg.style.filter = 'drop-shadow(0 6px 20px rgba(0,0,0,0.22))';

    svg.innerHTML = `
      <!-- Outer teal circle ring -->
      <circle cx="100" cy="100" r="95" fill="#e4f4fb" stroke="#3aaccc" stroke-width="5"/>

      <!-- Globe latitude lines (blue body beneath star) -->
      <ellipse cx="100" cy="115" rx="62" ry="42" fill="#2a7ab5" opacity="0.9"/>
      <ellipse cx="100" cy="115" rx="30" ry="42" fill="none" stroke="#1e5fa0" stroke-width="2" opacity="0.6"/>
      <ellipse cx="100" cy="115" rx="62" ry="20" fill="none" stroke="#1e5fa0" stroke-width="2" opacity="0.6"/>
      <ellipse cx="100" cy="115" rx="62" ry="8"  fill="none" stroke="#1e5fa0" stroke-width="1.5" opacity="0.4"/>

      <!-- Sparkle dots (cyan stars around the circle) -->
      <g fill="#00c8ef" opacity="0.9">
        <polygon points="30,52 32.5,45 35,52 28,48 37,48" transform="scale(0.85) translate(7,8)"/>
        <polygon points="165,40 167,34 169,40 163,37 171,37" transform="scale(0.7) translate(60,12)"/>
        <polygon points="160,140 162,134 164,140 158,137 166,137" transform="scale(0.7) translate(58,-14)"/>
        <circle cx="28"  cy="80"  r="3"/>
        <circle cx="170" cy="75"  r="2.5"/>
        <circle cx="168" cy="130" r="2"/>
        <circle cx="32"  cy="130" r="2.5"/>
      </g>

      <!-- Orange 5-point star -->
      <polygon
        points="100,28 112,68 155,68 121,93 133,133 100,108 67,133 79,93 45,68 88,68"
        fill="#f5a623"
        stroke="#e09010"
        stroke-width="1.5"
      />

      <!-- Person icon on star -->
      <circle cx="100" cy="82" r="10" fill="#fff"/>
      <path d="M80 108 Q100 96 120 108" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
    `;

    img.parentNode.replaceChild(svg, img);
    svg.id = 'brandLogo';
  }

  /* ── Join Now handler ───────────────────────── */
  function openJoin() {
    // Placeholder — wire to modal/page on future pages
    alert('Join GigHub — coming soon!');
  }

  /* ── Role toggle (used on pages with toggle) ── */
  function initRoleToggle() {
    const btns = document.querySelectorAll('.role-toggle__btn');
    if (!btns.length) return;

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const role = btn.dataset.role;
        document.dispatchEvent(new CustomEvent('gighub:rolechange', { detail: { role } }));
      });
    });
  }

  /* ── Init ───────────────────────────────────── */
  function init() {
    initRoleToggle();
  }

  document.addEventListener('DOMContentLoaded', init);

  /* Public API */
  return { useFallbackLogo, openJoin, initRoleToggle };

})();
