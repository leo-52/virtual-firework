uniform vec2 uFramebufferSize;

uniform sampler2D uTextures[4];
uniform float uPrescales[4];
uniform int uNumTextures;

uniform float uPostscale;

out vec4 outColor;

vec4 sample_input() {
  vec2 tc = gl_FragCoord.xy / uFramebufferSize;

  // these calculations have to be identical in shader_tone_map.frag and shader_accumulate_luminance_stats.frag
  vec4 color = vec4(0);
  if(uNumTextures > 0) color += uPrescales[0] * texture( uTextures[0], tc );
  if(uNumTextures > 1) color += uPrescales[1] * texture( uTextures[1], tc );
  if(uNumTextures > 2) color += uPrescales[2] * texture( uTextures[2], tc );
  if(uNumTextures > 3) color += uPrescales[3] * texture( uTextures[3], tc );

  if(uNumTextures > 4) color = vec4( 1, 0, 1, 1 );

  color *= uPostscale;
  return color;
}


const float SCALE = 0.955;

// "Glow" module constants
const float RRT_GLOW_GAIN = 0.05;
const float RRT_GLOW_MID = 0.08;

// Red modifier constants
const float RRT_RED_SCALE = 0.82;
const float RRT_RED_PIVOT = 0.03;
const float RRT_RED_HUE = 0.;
const float RRT_RED_WIDTH = 135.;

float glow_fwd( float ycIn, float glowGainIn, float glowMid) {
   float glowGainOut;
   if (ycIn <= 2./3. * glowMid) {
     glowGainOut = glowGainIn;
   } else if ( ycIn >= 2. * glowMid) {
     glowGainOut = 0.;
   } else {
     glowGainOut = glowGainIn * (glowMid / ycIn - 1./2.);
   }
   return glowGainOut;
}

float sigmoid_shaper( float x) {
    float t = max( 1. - abs( x / 2.), 0.);
    float y = 1. + sign(x) * (1. - t * t);
    return y / 2.;
}

// ------- Red modifier functions
float cubic_basis_shaper ( float x, float w) {
  mat4 M = mat4( -1./6,  3./6, -3./6,  1./6,
                  3./6, -6./6,  3./6,  0./6,
                 -3./6,  0./6,  3./6,  0./6,
                  1./6,  4./6,  1./6,  0./6);
  
  float y = 0;
  if ((x > -w/2.) && (x < w/2.)) {
    float knot_coord = (x - -w/2.) * 4./w;  
    int j = int(knot_coord);
    float t = knot_coord - j;

    float monomials[4] = float[]( t*t*t, t*t, t, 1. );

    if ( j == 3) {
      y = monomials[0] * M[0][0] + monomials[1] * M[1][0] + 
          monomials[2] * M[2][0] + monomials[3] * M[3][0];
    } else if ( j == 2) {
      y = monomials[0] * M[0][1] + monomials[1] * M[1][1] + 
          monomials[2] * M[2][1] + monomials[3] * M[3][1];
    } else if ( j == 1) {
      y = monomials[0] * M[0][2] + monomials[1] * M[1][2] + 
          monomials[2] * M[2][2] + monomials[3] * M[3][2];
    } else if ( j == 0) {
      y = monomials[0] * M[0][3] + monomials[1] * M[1][3] + 
          monomials[2] * M[2][3] + monomials[3] * M[3][3];
    } else {
      y = 0.0;
    }
  }
  
  return y * 3/2.;
}

float center_hue( float hue, float centerH)
{
  float hueCentered = hue - centerH;
  if (hueCentered < -180.) hueCentered = hueCentered + 360.;
  else if (hueCentered > 180.) hueCentered = hueCentered - 360.;
  return hueCentered;
}

float rgb_2_hue( vec3 v) {
  float hue;
  if (v.x == v.y && v.y == v.z) {
    hue = 180./M_PI; // RGB triplets where RGB are equal have an undefined hue
  } else {
    hue = (180./M_PI) * atan( sqrt(3.0)*(v.y-v.z), 2*v.x-v.y-v.z);
  }
  if (hue < 0.) hue = hue + 360.;
  return hue;
}

float rgb_2_yc( vec3 v ) {
  const float ycRadiusWeight = 1.75;
  float chroma = sqrt(v.b*(v.b-v.g)+v.g*(v.g-v.r)+v.r*(v.r-v.b));
  return ( v.b + v.g + v.r + ycRadiusWeight * chroma) / 3.;
}


const mat3 AP0_2_AP1_MAT = mat3(
   1.4514393161, -0.0765537734,  0.0083161484,
  -0.2365107469,  1.1762296998, -0.0060324498,
  -0.2149285693, -0.0996759264,  0.9977163014
);

const mat3 AP1_2_XYZ_MAT = mat3(
   0.6624541811, 0.2722287168, -0.0055746495,
   0.1340042065,  0.6740817658,  0.0040607335,
   0.1561876870, 0.0536895174,  1.0103391003
);
const mat3 XYZ_2_AP1_MAT = mat3(
   1.6410233797, -0.6636628587, 0.0117218943,
   -0.3248032942,  1.6153315917,  -0.0082844420,
   -0.2364246952, 0.0167563477,  0.9883948585
);

const mat3 RRT_SAT_MAT = mat3(
  0.970889,  0.0108892,  0.0108892,
  0.0269633,  0.986963,  0.0269633,
  0.00214758,  0.00214758,  0.962148
);

const mat3 ODT_SAT_MAT = mat3(
  0.949056,	0.019056,	0.019056,
  0.0471857,	0.977186,	0.0471857,
  0.00375827,	0.00375827,	0.933758
);

const mat3 D60_2_D65_CAT = mat3(
  0.987224,	-0.00759836,	0.00307257,
  -0.00611327,	1.00186,	-0.00509595,
  0.0159533,	0.00533002,	1.08168
);

const mat3 XYZ_2_DISPLAY_PRI_MAT = mat3(
  3.24097,	-0.969244,	0.0556301,
  -1.53738,	1.87597,	-0.203977,
  -0.498611,	0.0415551,	1.05697
);

const float TINY = 1e-10;
float max3 (vec3 v) { return max (max (v.x, v.y), v.z); }
float min3 (vec3 v) { return min (min (v.x, v.y), v.z); }
float rgb_2_saturation( vec3 color) {
  return ( max( max3(color), TINY) - max( min3(color), TINY)) / max( max3(color), 1e-2);
}

float log10( float n ) {
  const float kLogBase10 = 1.0 / log2( 10.0 );
  return log2( n ) * kLogBase10;
}






// Transformations between CIE XYZ tristimulus values and CIE x,y 
// chromaticity coordinates
vec3 XYZ_2_xyY( vec3 XYZ)
{  
  vec3 xyY;
  float divisor = (XYZ.r + XYZ.g + XYZ.b);
  xyY.r = XYZ.r / divisor;
  xyY.g = XYZ.g / divisor;  
  xyY.b = XYZ.g;
  
  return xyY;
}

vec3 xyY_2_XYZ( vec3 xyY)
{
  vec3 XYZ;
  XYZ.r = xyY.r * xyY.b / max( xyY.g, 1e-6);
  XYZ.g = xyY.b;  
  XYZ.b = (1.0 - xyY.r - xyY.g) * xyY.b / max( xyY.g, 1e-6);

  return XYZ;
}


// Target white and black points for cinema system tonescale
const float CINEMA_WHITE = 48.0;
const float CINEMA_BLACK = pow(10.0, log2(0.02) / log2(10.0)); // CINEMA_WHITE / 2400. 
    // CINEMA_BLACK is defined in this roundabout manner in order to be exactly equal to 
    // the result returned by the cinema 48-nit ODT tonescale.
    // Though the min point of the tonescale is designed to return 0.02, the tonescale is 
    // applied in log-log space, which loses precision on the antilog. The tonescale 
    // return value is passed into Y_2_linCV, where CINEMA_BLACK is subtracted. If 
    // CINEMA_BLACK is defined as simply 0.02, then the return value of this subfunction
    // is very, very small but not equal to 0, and attaining a CV of 0 is then impossible.
    // For all intents and purposes, CINEMA_BLACK=0.02.

// Gamma compensation factor
const float DIM_SURROUND_GAMMA = 0.9811;

// Saturation compensation factor
const float ODT_SAT_FACTOR = 0.93;
//const float ODT_SAT_MAT[3][3] = calc_sat_adjust_matrix( ODT_SAT_FACTOR, AP1_RGB2Y);

//const float D60_2_D65_CAT[3][3] = calculate_cat_matrix( AP0.white, REC709_PRI.white);

float Y_2_linCV( float Y, float Ymax, float Ymin) 
{
  return (Y - Ymin) / (Ymax - Ymin);
}

vec3 darkSurround_to_dimSurround( vec3 linearCV)
{
  vec3 XYZ = AP1_2_XYZ_MAT * linearCV; 
  vec3 xyY = XYZ_2_xyY(XYZ);
  xyY.z = clamp( xyY.z, 0., 1e9);
  xyY.z = pow( xyY.z, DIM_SURROUND_GAMMA);
  XYZ = xyY_2_XYZ(xyY);

  return XYZ_2_AP1_MAT * XYZ;
}





// Textbook monomial to basis-function conversion matrix.
const mat3 M = mat3(
   0.5, -1.0, 0.5,
  -1.0,  1.0, 0.5,
   0.5,  0.0, 0.0
);

float segmented_spline_c5_fwd ( float x ) {
  const float C_coefsLow[6] = float[]( -4.0000000000, -4.0000000000, -3.1573765773, -0.4852499958, 1.8477324706, 1.8477324706 );
  const float C_coefsHigh[6] = float[]( -0.7185482425, 2.0810307172, 3.6681241237, 4.0000000000, 4.0000000000, 4.0000000000 );
  const vec2 C_minPoint = vec2( 0.18*pow(2.,-15.0), 0.0001);
  const vec2 C_midPoint = vec2( 0.18,                4.8);
  const vec2 C_maxPoint = vec2( 0.18*pow(2., 18.0), 10000.);
  const float C_slopeLow = 0.0;
  const float C_slopeHigh = 0.0;



  const int N_KNOTS_LOW = 4;
  const int N_KNOTS_HIGH = 4;

  // Check for negatives or zero before taking the log. If negative or zero,
  // set to HALF_MIN.
  float logx = log10( max(x, 5.96046e-08 ));

  float logy;

  if ( logx <= log10(C_minPoint.x) ) { 

    logy = logx * C_slopeLow + ( log10(C_minPoint.y) - C_slopeLow * log10(C_minPoint.x) );

  } else if (( logx > log10(C_minPoint.x) ) && ( logx < log10(C_midPoint.x) )) {

    float knot_coord = (N_KNOTS_LOW-1) * (logx-log10(C_minPoint.x))/(log10(C_midPoint.x)-log10(C_minPoint.x));
    int j = int(knot_coord);
    float t = knot_coord - j;

    vec3 cf = vec3( C_coefsLow[ j], C_coefsLow[ j + 1], C_coefsLow[ j + 2]);
    vec3 monomials = vec3( t * t, t, 1. );
    logy = dot( monomials, M * cf );

  } else if (( logx >= log10(C_midPoint.x) ) && ( logx < log10(C_maxPoint.x) )) {

    float knot_coord = (N_KNOTS_HIGH-1) * (logx-log10(C_midPoint.x))/(log10(C_maxPoint.x)-log10(C_midPoint.x));
    int j = int(knot_coord);
    float t = knot_coord - j;

    vec3 cf = vec3( C_coefsHigh[ j], C_coefsHigh[ j + 1], C_coefsHigh[ j + 2]);
    vec3 monomials = vec3( t * t, t, 1. );
    logy = dot( monomials, M * cf );

  } else { //if ( logIn >= log10(C_maxPoint.x) ) { 

    logy = logx * C_slopeHigh + ( log10(C_maxPoint.y) - C_slopeHigh * log10(C_maxPoint.x) );

  }

  return pow(10.0, logy);

}

float segmented_spline_c9_fwd ( float x )
{
  const float C_coefsLow[10] = float[]( -1.6989700043, -1.6989700043, -1.4779000000, -1.2291000000, -0.8648000000, -0.4480000000, 0.0051800000, 0.4511080334, 0.9113744414, 0.9113744414 );
  const float C_coefsHigh[10] = float[]( 0.5154386965, 0.8470437783, 1.1358000000, 1.3802000000, 1.5197000000, 1.5985000000, 1.6467000000, 1.6746091357, 1.6878733390, 1.6878733390 );
  const vec2 C_minPoint = vec2( 0.0028799, 0.02);
  const vec2 C_midPoint = vec2( 4.8, 4.8);
  const vec2 C_maxPoint = vec2( 1005.72, 48.);
  const float C_slopeLow = 0.0;
  const float C_slopeHigh = 0.04;



  const int N_KNOTS_LOW = 8;
  const int N_KNOTS_HIGH = 8;

  // Check for negatives or zero before taking the log. If negative or zero,
  // set to HALF_MIN.
  float logx = log10( max(x, 5.96046e-08 ));

  float logy;

  if ( logx <= log10(C_minPoint.x) ) { 

    logy = logx * C_slopeLow + ( log10(C_minPoint.y) - C_slopeLow * log10(C_minPoint.x) );

  } else if (( logx > log10(C_minPoint.x) ) && ( logx < log10(C_midPoint.x) )) {
    float knot_coord = (N_KNOTS_LOW-1) * (logx-log10(C_minPoint.x))/(log10(C_midPoint.x)-log10(C_minPoint.x));
    int j = int(knot_coord);
    float t = knot_coord - j;

    vec3 cf = vec3( C_coefsLow[ j], C_coefsLow[ j + 1], C_coefsLow[ j + 2]);
    vec3 monomials = vec3( t * t, t, 1. );
    logy = dot( monomials, M * cf );

  } else if (( logx >= log10(C_midPoint.x) ) && ( logx < log10(C_maxPoint.x) )) {
    float knot_coord = (N_KNOTS_HIGH-1) * (logx-log10(C_midPoint.x))/(log10(C_maxPoint.x)-log10(C_midPoint.x));
    int j = int(knot_coord);
    float t = knot_coord - j;

    vec3 cf = vec3( C_coefsHigh[ j], C_coefsHigh[ j + 1], C_coefsHigh[ j + 2]);
    vec3 monomials = vec3( t * t, t, 1. );
    logy = dot( monomials, M * cf );

  } else {
    logy = logx * C_slopeHigh + ( log10(C_maxPoint.y) - C_slopeHigh * log10(C_maxPoint.x) );
  }

  return pow(10.0, logy);
}



void do_aces_tonemapping(void) {
  vec4 input_color = sample_input();
  vec3 color = input_color.rgb;

    //RRT starts here

    //we don't do glow and red in the AP0 colorspace, it doesn't appear to make a difference
    //and this way we avoid jumping around
    //color = AP1_2_AP0_MAT * color;

  // --- Glow module --- //
    float saturation = rgb_2_saturation( color);
    float ycIn = rgb_2_yc( color);
    float s = sigmoid_shaper( (saturation - 0.4) / 0.2);
    float addedGlow = 1. + glow_fwd( ycIn, RRT_GLOW_GAIN * s, RRT_GLOW_MID);

    color = addedGlow * color;

  // --- Red modifier --- //
    float hue = rgb_2_hue( color);
    float centeredHue = center_hue( hue, RRT_RED_HUE);
    float hueWeight = cubic_basis_shaper( centeredHue, RRT_RED_WIDTH);

    color[0] = color[0] + hueWeight * saturation * (RRT_RED_PIVOT - color[0]) * (1. - RRT_RED_SCALE);

  // --- ACES to RGB rendering space --- //
    //color = clamp( color, 0., 1e9);  // avoids saturated negative colors from becoming positive in the matrix

    //color = AP0_2_AP1_MAT * color;

    color = clamp( color, 0., 65504.0);

  // --- Global desaturation --- //
    color = RRT_SAT_MAT * color;

  // --- Apply the tonescale independently in rendering-space RGB --- //
    color[0] = segmented_spline_c5_fwd( color[0]);
    color[1] = segmented_spline_c5_fwd( color[1]);
    color[2] = segmented_spline_c5_fwd( color[2]);

    //ODT starts here

  // Apply the tonescale independently in rendering-space RGB
    color[0] = segmented_spline_c9_fwd( color[0]);
    color[1] = segmented_spline_c9_fwd( color[1]);
    color[2] = segmented_spline_c9_fwd( color[2]);

  // Scale luminance to linear code value
    color[0] = Y_2_linCV( color[0], CINEMA_WHITE, CINEMA_BLACK);
    color[1] = Y_2_linCV( color[1], CINEMA_WHITE, CINEMA_BLACK);
    color[2] = Y_2_linCV( color[2], CINEMA_WHITE, CINEMA_BLACK);

//define undef
#undef SIMULATE_D60_WHITEPOINT
#ifdef SIMULATE_D60_WHITEPOINT
  // --- Compensate for different white point being darker  --- //
  // This adjustment is to correct an issue that exists in ODTs where the device 
  // is calibrated to a white chromaticity other than D60. In order to simulate 
  // D60 on such devices, unequal code values are sent to the display to achieve 
  // neutrals at D60. In order to produce D60 on a device calibrated to the DCI 
  // white point (i.e. equal code values yield CIE x,y chromaticities of 0.314, 
  // 0.351) the red channel is higher than green and blue to compensate for the 
  // "greenish" DCI white. This is the correct behavior but it means that as 
  // highlight increase, the red channel will hit the device maximum first and 
  // clip, resulting in a chromaticity shift as the green and blue channels 
  // continue to increase.
  // To avoid this clipping error, a slight scale factor is applied to allow the 
  // ODTs to simulate D60 within the D65 calibration white point. 

    // Scale and clamp white to avoid casted highlights due to D60 simulation
    color[0] = min( color[0], 1.0) * SCALE;
    color[1] = min( color[1], 1.0) * SCALE;
    color[2] = min( color[2], 1.0) * SCALE;
#endif

  // Apply gamma adjustment to compensate for dim surround
    color = darkSurround_to_dimSurround( color);

  // Apply desaturation to compensate for luminance difference
    color = ODT_SAT_MAT * color;

  // Convert to display primary encoding Rendering space RGB to XYZ
    color = AP1_2_XYZ_MAT * color;

#ifndef SIMULATE_D60_WHITEPOINT
  // Apply CAT from ACES white point to assumed observer adapted white point
    color = D60_2_D65_CAT * color;
#endif

  // CIE XYZ to display primaries
    color = XYZ_2_DISPLAY_PRI_MAT * color;

  outColor = clamp(linearToSrgb(vec4(color, 0)), 0, 1);
  outColor.a = input_color.a;
}

// https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
void do_aces_curvefit_tonemapping(void) {
  vec4 input_color = sample_input();
  vec3 color = input_color.rgb;

  //"For the original ACES curve just multiply input (x) by 0.6."
  vec3 x = color*0.6;

  float a = 2.51f;
  float b = 0.03f;
  float c = 2.43f;
  float d = 0.59f;
  float e = 0.14f;
  color = clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
  outColor = vec4(color, 0);
  outColor = linearToSrgb(vec4(color, 0));
  outColor.a = input_color.a;
}


void do_srgb_only(void) {
  vec4 input_color = sample_input();
  outColor = linearToSrgb(input_color);
}


void main() {
    do_aces_tonemapping();
    // do_aces_curvefit_tonemapping();
    // do_srgb_only();
}
