/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @color
 * @default #355070
 */
uniform vec3 u_color1;

/**
 * @color
 * @default #6d597a
 */
uniform vec3 u_color2;

/**
 * @color
 * @default #b56576
 */
uniform vec3 u_color3;

/**
 * @color
 * @default #eaac8b
 */
uniform vec3 u_color4;

/**
 * Rotation of the color layout, in degrees.
 * @default 45
 * @range 0, 360
 */
uniform float u_patternAngle;

/**
 * How defined the color zones are. Low = soft washes, high = tight pools.
 * @default 0.4
 * @range 0, 1
 */
uniform float u_patternDetail;

/**
 * How far the colors roam. 0 = points stay put.
 * @default 1.5
 * @range 0, 4
 */
uniform float u_patternSwirl;

/**
 * How fast the gradient reshapes. 0 = frozen.
 * @default 0.05
 * @range 0, 1
 */
uniform float u_patternSpeed;

/**
 * Slow drift of the whole gradient. 0 = no slide.
 * @default 0.03
 * @range 0, 1
 */
uniform float u_slideSpeed;

/**
 * Direction the gradient slides, in degrees.
 * @default 90
 * @range 0, 360
 */
uniform float u_slideAngle;

/**
 * Angle of the glass stripes, in degrees.
 * @default 45
 * @range 0, 360
 */
uniform float u_stripeAngle;

/**
 * Width of each glass stripe, in pixels.
 * @default 70
 * @range 1, 300
 */
uniform float u_stripeWidth;

/**
 * How strongly the glass bends the colors. Negative pinches inward.
 * @default 50
 * @range -200, 200
 */
uniform float u_bend;

/**
 * Stripe shape. 0 = soft round waves, higher = fuller stripes.
 * @default 0.5
 * @range 0, 5
 */
uniform float u_sharpness;

/**
 * Rainbow fringing along the stripe edges. 0 = none.
 * @default 0.4
 * @range 0, 1
 */
uniform float u_colorSplit;

/**
 * How much of the surface eases off into calm patches.
 * @default 1
 * @range 0, 2
 */
uniform float u_calmAmount;

/**
 * How flat the calm patches go. 1 = fully flat.
 * @default 1
 * @range 0, 1
 */
uniform float u_calmStrength;

/**
 * Size of the calm patches.
 * @default 2
 * @range 0.1, 10
 */
uniform float u_calmSize;

/**
 * How fast the calm patches drift. 0 = still.
 * @default 0.5
 * @range 0, 2
 */
uniform float u_calmSpeed;

/**
 * Film grain over the result. 0 = clean.
 * @default 0.06
 * @range 0, 0.3
 */
uniform float u_grain;

/**
 * How far the glass twirls around its center, in degrees. 0 = none.
 * @default 0
 * @range -360, 360
 */
uniform float u_twirlAmount;

/**
 * How far out the twirl reaches, as a fraction of the shape.
 * @default 1.2
 * @range 0.1, 3
 */
uniform float u_twirlRadius;

#define PI 3.14159265359

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise(p);
    p = p * 2.0 + 19.7;
    amp *= 0.5;
  }
  return sum;
}

vec3 srgbToLinear(vec3 c) {
  return pow(c, vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(l, 1.0 / 3.0);
  m = pow(m, 1.0 / 3.0);
  s = pow(s, 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklabToLinear(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec2 toroDelta(vec2 d, vec2 period) {
  return d - period * floor(d / period + 0.5);
}

vec2 wander(float id, float t) {
  float a = fbm(vec2(id * 11.3 + t, id * 3.1));
  float b = fbm(vec2(id * 7.7, id * 17.9 + t));
  return vec2(a, b) - 0.5;
}

vec3 meshGradient(vec2 uv) {
  float t = u_time * u_patternSpeed;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  float ang = radians(u_patternAngle);
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 ctr = vec2(aspect * 0.5, 0.5);
  vec2 rp = p - ctr;
  p = ctr + vec2(rp.x * ca - rp.y * sa, rp.x * sa + rp.y * ca);

  float sl = radians(u_slideAngle);
  p += vec2(cos(sl), sin(sl)) * (u_slideSpeed * u_time);
  vec2 period = vec2(aspect, 1.0);

  float roam = min(u_patternSwirl, 4.0) * 0.22;
  vec2 P0 = vec2(0.14 * aspect, 0.22) + roam * wander(0.0, t);
  vec2 P1 = vec2(0.86 * aspect, 0.16) + roam * wander(1.0, t);
  vec2 P2 = vec2(0.50 * aspect, 0.50) + roam * wander(2.0, t);
  vec2 P3 = vec2(0.18 * aspect, 0.84) + roam * wander(3.0, t);
  vec2 P4 = vec2(0.88 * aspect, 0.86) + roam * wander(4.0, t);
  vec2 P5 = vec2(0.50 * aspect, 0.04) + roam * wander(5.0, t);

  vec3 a1 = linearToOklab(srgbToLinear(u_color1));
  vec3 a2 = linearToOklab(srgbToLinear(u_color2));
  vec3 a3 = linearToOklab(srgbToLinear(u_color3));
  vec3 a4 = linearToOklab(srgbToLinear(u_color4));

  float power = mix(2.0, 6.0, clamp(u_patternDetail, 0.0, 1.0));
  float w0 = 1.0 / (pow(length(toroDelta(p - P0, period)), power) + 1e-4);
  float w1 = 1.0 / (pow(length(toroDelta(p - P1, period)), power) + 1e-4);
  float w2 = 1.0 / (pow(length(toroDelta(p - P2, period)), power) + 1e-4);
  float w3 = 1.0 / (pow(length(toroDelta(p - P3, period)), power) + 1e-4);
  float w4 = 1.0 / (pow(length(toroDelta(p - P4, period)), power) + 1e-4);
  float w5 = 1.0 / (pow(length(toroDelta(p - P5, period)), power) + 1e-4);
  float ws = w0 + w1 + w2 + w3 + w4 + w5;

  vec3 lab = (a1 * w0 + a2 * w1 + a3 * w2 + a4 * w3 + a2 * w4 + a4 * w5) / ws;
  return linearToSrgb(oklabToLinear(lab));
}

void main() {
  float la = radians(u_stripeAngle);
  vec2 lineDir = vec2(cos(la), sin(la));
  vec2 perp = vec2(-lineDir.y, lineDir.x);

  float width = max(u_stripeWidth, 1.0);

  vec2 np = gl_FragCoord.xy / u_resolution.x * (4.0 / max(u_calmSize, 0.1));
  vec2 ndrift = vec2(u_time * u_calmSpeed, u_time * u_calmSpeed * 0.6);
  float n = fbm(np + ndrift);
  float calmMask = clamp(n * u_calmAmount, 0.0, 1.0);
  float strength = u_bend * (1.0 - calmMask * u_calmStrength);

  vec2 tc = gl_FragCoord.xy - u_resolution * 0.5;
  float reach = max(min(u_resolution.x, u_resolution.y) * 0.5 * u_twirlRadius, 1.0);
  float fall = clamp(1.0 - length(tc) / reach, 0.0, 1.0);
  float ta = radians(u_twirlAmount) * fall * fall;
  float tcos = cos(ta);
  float tsin = sin(ta);
  vec2 twirled = u_resolution * 0.5 + vec2(tc.x * tcos - tc.y * tsin, tc.x * tsin + tc.y * tcos);

  float p = fract(dot(twirled, perp) / width);
  float s = sin(p * 2.0 * PI);
  float curve = s * (1.0 + u_sharpness) / (1.0 + u_sharpness * abs(s));
  vec2 offset = perp * curve * strength * 3.0;

  const int SAMPLES = 12;
  vec3 sum = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    float t = float(i) / float(SAMPLES - 1);
    vec3 weight = vec3(
      smoothstep(0.55, 0.0, t),
      1.0 - abs(t - 0.5) * 2.0,
      smoothstep(0.45, 1.0, t)
    );
    float spread = (t - 0.5) * 2.0 * u_colorSplit;
    vec2 uv = (gl_FragCoord.xy + offset * (1.0 + spread)) / u_resolution;
    sum += meshGradient(uv) * weight;
    wsum += weight;
  }
  vec3 color = sum / wsum;

  color += (grainHash(gl_FragCoord.xy) - 0.5) * u_grain;

  gl_FragColor = vec4(color, 1.0);
}
