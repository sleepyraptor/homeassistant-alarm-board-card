/**
 * Drawn camera frames for the demo and the README screenshots.
 * No real camera footage is ever used: every room here is a handful of SVG shapes,
 * finished with the on-screen display and the grain of a cheap indoor camera.
 */
const W = 1920;
const H = 1080;

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** Day palette, and the washed-out greys of an infrared camera at night. */
const PALETTE = {
  day: {
    wall: "#d9cdb8", wall2: "#cbbda5", floor: "#8a6a4f", floor2: "#6f533c",
    sky: "#9cc7e6", sky2: "#d8ecf7", wood: "#7a5434", fabric: "#4f6d8f", fabric2: "#3f5874",
    accent: "#c96f4a", leaf: "#3f7a4a", metal: "#5a5f66", screen: "#1d2733", light: "#fff3c4"
  },
  night: {
    wall: "#7d847e", wall2: "#6e756f", floor: "#4b514c", floor2: "#3d423e",
    sky: "#1f2420", sky2: "#2c322d", wood: "#4a504b", fabric: "#5b625c", fabric2: "#4d544e",
    accent: "#6a716b", leaf: "#555c56", metal: "#5d645e", screen: "#9fb5a3", light: "#b9c4ba"
  }
};

const person = (x, y, s, night) => {
  const c = night ? "#141714" : "#23201d";
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${night ? 0.92 : 0.95}">
    <ellipse cx="0" cy="560" rx="120" ry="18" fill="#000" opacity=".25"/>
    <circle cx="0" cy="40" r="46" fill="${c}"/>
    <path d="M-70 110 Q0 80 70 110 L95 330 L60 335 L52 560 L12 560 L4 360 L-4 360 L-12 560 L-52 560 L-60 335 L-95 330 Z" fill="${c}"/>
    <path d="M-70 120 L-120 300 L-95 310 L-55 175 Z M70 120 L125 290 L100 300 L55 175 Z" fill="${c}"/>
  </g>`;
};

const window_ = (x, y, w, h, p, curtains) => `
  <rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="${p.wall2}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sky)"/>
  <rect x="${x + w / 2 - 6}" y="${y}" width="12" height="${h}" fill="${p.wall2}"/>
  <rect x="${x}" y="${y + h / 2 - 6}" width="${w}" height="12" fill="${p.wall2}"/>
  ${curtains ? `<path d="M${x - 40} ${y - 30} h120 q-30 ${h / 2} 10 ${h + 60} h-130 Z" fill="${p.accent}" opacity=".85"/>
  <path d="M${x + w + 40} ${y - 30} h-120 q30 ${h / 2} -10 ${h + 60} h130 Z" fill="${p.accent}" opacity=".85"/>` : ""}`;

const ROOMS = {
  living_room: (p, night) => `
    ${window_(260, 170, 520, 380, p, false)}
    <rect x="1290" y="190" width="300" height="640" fill="${p.wood}"/>
    <rect x="1310" y="210" width="260" height="620" fill="${night ? "#2a2f2b" : "#3b2c22"}"/>
    <ellipse cx="900" cy="930" rx="560" ry="90" fill="${p.accent}" opacity=".55"/>
    <rect x="420" y="600" width="760" height="190" rx="40" fill="${p.fabric}"/>
    <rect x="420" y="520" width="760" height="140" rx="50" fill="${p.fabric2}"/>
    <rect x="380" y="600" width="90" height="230" rx="35" fill="${p.fabric2}"/>
    <rect x="1130" y="600" width="90" height="230" rx="35" fill="${p.fabric2}"/>
    <rect x="600" y="840" width="420" height="40" rx="8" fill="${p.wood}"/>
    <rect x="630" y="880" width="18" height="70" fill="${p.wood}"/><rect x="972" y="880" width="18" height="70" fill="${p.wood}"/>
    <rect x="1700" y="300" width="14" height="560" fill="${p.metal}"/>
    <path d="M1640 300 h134 l-30 -110 h-74 Z" fill="${p.light}"/>
    <rect x="150" y="760" width="110" height="140" rx="12" fill="${p.wood}"/>
    <path d="M205 770 q-90 -120 -40 -260 q30 120 40 260 q10 -170 70 -250 q20 140 -70 250 Z" fill="${p.leaf}"/>`,
  bedroom: (p, night) => `
    ${window_(1260, 190, 420, 340, p, true)}
    <rect x="160" y="250" width="300" height="640" fill="${p.wood}"/>
    <line x1="310" y1="260" x2="310" y2="880" stroke="${p.wall2}" stroke-width="6"/>
    <rect x="560" y="420" width="640" height="210" rx="18" fill="${p.wood}"/>
    <rect x="520" y="600" width="720" height="250" rx="24" fill="${p.fabric}"/>
    <rect x="600" y="560" width="230" height="90" rx="30" fill="${night ? "#8c938d" : "#eef0f2"}"/>
    <rect x="930" y="560" width="230" height="90" rx="30" fill="${night ? "#8c938d" : "#eef0f2"}"/>
    <path d="M520 690 h720 v160 a24 24 0 0 1 -24 24 h-672 a24 24 0 0 1 -24 -24 Z" fill="${p.fabric2}"/>
    <rect x="1290" y="700" width="170" height="160" rx="10" fill="${p.wood}"/>
    <rect x="1350" y="610" width="12" height="90" fill="${p.metal}"/>
    <path d="M1310 610 h92 l-18 -70 h-56 Z" fill="${p.light}"/>`,
  office: (p, night) => `
    ${window_(1350, 160, 380, 420, p, false)}
    <rect x="180" y="200" width="420" height="40" fill="${p.wood}"/>
    <rect x="180" y="330" width="420" height="40" fill="${p.wood}"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${200 + i * 40}" y="${130 + (i % 3) * 8}" width="30" height="${70 - (i % 3) * 8}" fill="${i % 2 ? p.accent : p.fabric}"/>`).join("")}
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${220 + i * 46}" y="${262 + (i % 2) * 10}" width="34" height="${68 - (i % 2) * 10}" fill="${i % 2 ? p.leaf : p.accent}"/>`).join("")}
    <rect x="560" y="640" width="900" height="44" rx="6" fill="${p.wood}"/>
    <rect x="600" y="684" width="24" height="230" fill="${p.wood}"/><rect x="1396" y="684" width="24" height="230" fill="${p.wood}"/>
    <rect x="800" y="380" width="420" height="250" rx="14" fill="${p.metal}"/>
    <rect x="820" y="398" width="380" height="212" rx="6" fill="${p.screen}"/>
    <rect x="990" y="630" width="40" height="14" fill="${p.metal}"/>
    <rect x="840" y="760" width="300" height="60" rx="20" fill="${p.fabric2}"/>
    <rect x="880" y="560" width="220" height="210" rx="30" fill="${p.fabric}" opacity=".95"/>
    <rect x="980" y="820" width="20" height="90" fill="${p.metal}"/>`
};

const LABELS = { living_room: "CAM 01  LIVING ROOM", bedroom: "CAM 02  BEDROOM", office: "CAM 03  OFFICE" };
const INTRUDER = { living_room: [1440, 300, 0.95], bedroom: [1080, 330, 0.9], office: [470, 340, 0.92] };

/** One frame as an SVG document. */
export function scene(cam, date, { night = false, intruder = false } = {}) {
  const p = night ? PALETTE.night : PALETTE.day;
  const room = ROOMS[cam] || ROOMS.living_room;
  const [ix, iy, is] = INTRUDER[cam] || INTRUDER.living_room;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky}"/><stop offset="1" stop-color="${p.sky2}"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.floor}"/><stop offset="1" stop-color="${p.floor2}"/></linearGradient>
    <radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${night ? 0.65 : 0.45}"/></radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="${night ? 0.9 : 0.75}" numOctaves="2" seed="${date.getSeconds()}"/>
      <feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 ${night ? 0.22 : 0.1} 0"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="${night ? 2.2 : 1.2}"/></filter>
  </defs>
  <g filter="url(#soft)">
    <rect width="${W}" height="${H}" fill="${p.wall}"/>
    <rect y="820" width="${W}" height="${H - 820}" fill="url(#floor)"/>
    <rect y="812" width="${W}" height="14" fill="${p.wall2}"/>
    ${room(p, night)}
    ${intruder ? person(ix, iy, is, night) : ""}
  </g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <g font-family="DejaVu Sans Mono, Menlo, Consolas, monospace" font-size="44" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">
    <text x="48" y="80">${LABELS[cam] || cam.toUpperCase()}</text>
    <text x="${W - 48}" y="80" text-anchor="end">${stamp(date)}</text>
    ${night ? `<text x="48" y="134" font-size="34">IR</text>` : ""}
    <circle cx="${W - 70}" cy="${H - 62}" r="16" fill="#e53935" stroke="none"/>
    <text x="${W - 100}" y="${H - 48}" text-anchor="end" font-size="34">REC</text>
  </g>
</svg>`;
}

export const dataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
