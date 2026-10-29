/**
 * Every tunable number and every line of copy lives here.
 * All Bengali copy is a draft until native speakers have read it (TODO: Bengali review).
 */
export const config = {
  palette: {
    night: '#030202',
    amber: '#ffb347',
    flameOuter: '#d8401a',
    flameCore: '#fff2c8',
    jaba: '#c4122b',
    gold: '#e8b54a',
    ink: '#f3e6cf',
    tube: '#dfeaff',
  },

  render: {
    dprPhone: 1.5,
    dprDesktop: 2,
    phoneMaxShortSide: 600,
    /** The light map (sum of every lamp's glow) is drawn at this fraction of the screen; it is soft anyway. */
    lightScale: 0.25,
  },

  bloom: { intensity: 1.15, threshold: 0.52, smoothing: 0.35, radius: 0.72 },
  post: { vignetteOffset: 0.28, vignetteDarkness: 0.62, grain: 0.035 },

  parallax: {
    /** Camera nudge in world units at full input. */
    amount: 0.35,
    gyroRangeDeg: 18,
    mouseIdleSeconds: 2.5,
    driftHz: 0.05,
    driftAmount: 0.35,
    halfLife: 0.18,
  },

  lamp: {
    flicker: 0.14,
    igniteSeconds: 0.55,
  },

  /** Where the flame sits on each lamp picture, in lamp widths from its centre (measured on the generated art). */
  flames: {
    prodip: { flameX: 0.43, flameLift: 0.17, flameSize: 0.78 },
    prodipPlaceholder: { flameX: 0, flameLift: 0.16, flameSize: 1.15 },
    candle: { flameX: -0.02, flameLift: 0.47, flameSize: 0.8 },
    candlePlaceholder: { flameX: 0, flameLift: 0.5, flameSize: 0.9 },
  },

  journey: {
    /** How long a chapter's title holds over its scene before the scene begins. */
    titleSeconds: 2.8,
  },

  intro: {
    count: 108,
    /** Rows of steps. Portrait screens get more, narrower rows so a finger can sweep each one. */
    rowsLandscape: 6,
    rowsPortrait: 9,
    widthLandscape: 14,
    widthPortrait: 5.4,
    rise: 0.3,
    tread: 1.05,
    lampScale: 0.5,
    /** Catch radius as a fraction of the on-screen gap between two lamps. */
    catchFraction: 0.75,
    catchMinPx: 16,
    /** Light the rest by themselves once this much is lit. */
    autoFinishAt: 0.9,
    assistAfterSeconds: 7,
    maHeight: 4.6,
    darkSeconds: 4,
    midnightSeconds: 7.5,
  },

  mala: {
    flowers: 10,
    flowerSize: 0.12,
    needleCatch: 0.6,
    ropeSegments: 160,
    /** The full-bleed thala picture: water centre and radius (fractions of its width), and where its lamp stands. */
    // Measured on mala/thala-scene: water centre (0.505, 0.5), radius 0.22 of the width; its prodip at (0.255, 0.27).
    scene: { cx: 0.505, cy: 0.5, r: 0.22, lampU: 0.255, lampV: 0.27 },
  },

  bhoot: {
    lamps: 7,
    carryRadius: 0.95,
    catchRadius: 0.07,
  },

  chhad: {
    /** চোদ্দ প্রদীপ, for the চোদ্দ পুরুষ. */
    lamps: 14,
    /** Ledge height in the full rooftop pictures, as a fraction from the top (measured on the art). */
    ledgeWide: 0.655,
    ledgeTall: 0.7,
    rockets: 22,
  },

  copy: {
    title: 'কালীপুজো ২০২৬ · Kali Puja 2026',
    gate: {
      kicker: 'কালীপুজো · দীপাবলি ২০২৬',
      title: 'অমাবস্যা',
      sub: 'কালীপুজোর রাত',
      button: { bn: 'প্রদীপ জ্বালাও', en: 'Light the lamp' },
    },
    intro: {
      dark: { bn: 'কার্তিক অমাবস্যা। রাত সাড়ে এগারোটা।', en: 'The new moon of Kartik. Half past eleven.' },
      invite: { bn: 'শিখাটা নিয়ে প্রদীপগুলো ছুঁয়ে যাও', en: 'Carry the flame across the lamps' },
      inviteTouch: 'আঙুল ছুঁইয়ে টেনে নিয়ে যাও',
      midnight: { bn: 'রাত বারোটা।', en: 'Midnight.' },
      greeting: 'শুভ কালীপুজো',
      jai: 'জয় মা কালী',
      greetingSub: 'শুভ দীপাবলি',
    },
    mala: {
      title: 'জবার মালা',
      line: 'মায়ের মালাটা এবার তুমি গাঁথো।',
      invite: { bn: 'সুঁচে সুতো পরানো আছে। ফুলগুলোর ভেতর দিয়ে টেনে নিয়ে যাও।', en: 'Pull the needle through the flowers' },
      inviteTouch: 'সুঁচে সুতো পরানো আছে। ফুলগুলো এক এক করে ছুঁয়ে গাঁথো।',
      done: { bn: 'মালা মায়ের গলায়।', en: 'The garland is Ma’s now.' },
    },
    bhoot: {
      title: 'ভূত চতুর্দশী',
      line: 'কালীপুজোর আগের রাত। সাতটা ঘর, সাতটা প্রদীপ। আর প্রতিটা ঘরে কেউ একজন আছে।',
      start: { bn: 'লোডশেডিং।', en: 'Power cut.' },
      invite: { bn: 'প্রদীপ হাতে এক এক করে ঘরে ঢোকো। আলো পড়লেই দেখবে কে আছে।', en: 'Take the lamp into each room. The light shows who is there.' },
      inviteTouch: 'যে ঘরে ছোঁবে, প্রদীপ সেখানে যাবে। আলো পড়লেই দেখবে কে আছে।',
      /** In the order of bhoot/ghost-1..7. */
      ghosts: ['শাঁকচুন্নি', 'পেত্নী', 'নিশি', 'ব্রহ্মদৈত্য', 'মেছোভূত', 'কানাভুলো', 'যখ'],
      done: { bn: 'কারেন্ট এসে গেছে!', en: 'The power is back.' },
    },
    chhad: {
      title: 'ছাদের দীপাবলি',
      line: 'চোদ্দ পুরুষের জন্য চোদ্দটা প্রদীপ। পাঁচিলে সাজানো আছে, এখনও কেউ জ্বালায়নি।',
      lamps: { bn: 'পাঁচিল বরাবর আঙুল টেনে প্রদীপগুলো জ্বালাও', en: 'Sweep along the parapet to light the lamps' },
      finale: 'শুভ দীপাবলি',
      finaleSub: 'শুভ কালীপুজো',
    },
    baji: {
      title: 'বাজির রাত',
      line: 'তুবড়ি, রকেট, চরকি সব ছাদে রাখা আছে। আকাশটা এবার তোমার।',
      hint: { bn: 'আকাশের যেখানে খুশি ছোঁও', en: 'Tap anywhere in the sky' },
      rocket: 'রকেট',
      tubri: 'তুবড়ি',
      chorki: 'চরকি',
      torch: 'রংমশাল',
      sparkler: 'ফুলঝুরি',
      skyshot: 'স্কাইশট',
      sparklerHint: { bn: 'ফুলঝুরি হাতে। আঙুল টেনে আকাশে কিছু লিখে দেখো।', en: 'Move it to write in the sky' },
    },
    end: {
      kicker: 'কালীপুজো · দীপাবলি ২০২৬',
      title: 'শুভ দীপাবলি',
      sub: 'শুভ কালীপুজো',
    },
    ui: {
      skip: 'Skip',
      share: 'Share',
      again: 'Watch again',
      shareText: 'অমাবস্যার রাতে ১০৮টা প্রদীপ জ্বালালাম। তুমিও জ্বালাও:',
    },
  },
};

export type Copy = typeof config.copy;
