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

  intro: {
    count: 108,
    /** Rows of steps. Portrait screens get more, narrower rows so a finger can sweep each one. */
    rowsLandscape: 6,
    rowsPortrait: 9,
    widthLandscape: 9.6,
    widthPortrait: 3.7,
    rise: 0.3,
    tread: 0.85,
    lampScale: 0.34,
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
    flowerSize: 0.14,
    needleCatch: 0.6,
    ropeSegments: 160,
  },

  bhoot: {
    lamps: 14,
    carryRadius: 0.95,
    catchRadius: 0.07,
  },

  chhad: {
    candles: 12,
    tubriSeconds: 5,
    sparklerInk: 7,
  },

  copy: {
    title: 'কালীপুজো ২০২৬ · Kali Puja 2026',
    gate: {
      title: 'অমাবস্যা',
      sub: 'কালীপুজোর রাত',
      button: { bn: 'প্রদীপ জ্বালাও', en: 'Light the lamp' },
    },
    intro: {
      dark: { bn: 'কার্তিক অমাবস্যা। রাত সাড়ে এগারোটা।', en: 'The new moon of Kartik. Half past eleven.' },
      invite: { bn: 'শিখাটা নিয়ে প্রদীপগুলো ছুঁয়ে যাও', en: 'Carry the flame across the lamps' },
      inviteTouch: 'আঙুল ছুঁইয়ে টেনে নিয়ে যাও',
      midnight: { bn: 'রাত বারোটা।', en: 'Midnight.' },
      verse: [
        'জয়ন্তী মঙ্গলা কালী ভদ্রকালী কপালিনী।',
        'দুর্গা শিবা ক্ষমা ধাত্রী স্বাহা স্বধা নমোঽস্তু তে॥',
      ],
      greeting: 'শুভ কালীপুজো',
      greetingSub: 'শুভ দীপাবলি',
      scrollCue: 'নিচে আরও আছে',
    },
    mala: {
      title: 'জবার মালা',
      line: 'মায়ের মালাটা এবার তুমি গাঁথো।',
      invite: { bn: 'সুঁচে সুতো পরানো আছে। ফুলগুলোর ভেতর দিয়ে টেনে নিয়ে যাও।', en: 'Pull the needle through the flowers' },
      done: { bn: 'মালা মায়ের গলায়।', en: 'The garland is Ma’s now.' },
    },
    bhoot: {
      title: 'ভূত চতুর্দশী',
      line: 'কালীপুজোর আগের রাত। চোদ্দটা প্রদীপ জ্বালাতে হয়, নইলে ওরা ঘুরে বেড়ায়।',
      start: { bn: 'লোডশেডিং।', en: 'Power cut.' },
      invite: { bn: 'প্রদীপ হাতে বাড়িটা ঘুরে দেখো। চোদ্দ জায়গায় চোদ্দটা।', en: 'Carry the lamp through the house. Fourteen corners.' },
      done: { bn: 'কারেন্ট এসে গেছে!', en: 'The power is back.' },
    },
    chhad: {
      title: 'ছাদের দীপাবলি',
      line: 'সন্ধে নেমেছে। পাঁচিলের মোমবাতিগুলো এখনও কেউ জ্বালায়নি।',
      candles: { bn: 'পাঁচিল বরাবর মোমবাতি জ্বালাও', en: 'Light the candles along the parapet' },
      lantern: { bn: 'আকাশপ্রদীপটা তোলো। দড়িটা নিচে টানো।', en: 'Raise the akash prodip: pull the rope down' },
      tubri: { bn: 'তুবড়িতে আগুন দাও', en: 'Light the tubri' },
      sparkler: { bn: 'এবার ফুলঝুরি। আকাশে যা খুশি লেখো।', en: 'Now the phuljhuri. Write anything on the sky.' },
      finale: 'শুভ দীপাবলি',
      finaleSub: 'শুভ কালীপুজো',
    },
    ui: {
      skip: 'Skip',
      share: 'Share',
      again: 'Watch again',
      next: 'নিচে চলো',
      shareText: 'অমাবস্যার রাতে ১০৮টা প্রদীপ জ্বালালাম। তুমিও জ্বালাও:',
    },
  },
};

export type Copy = typeof config.copy;
