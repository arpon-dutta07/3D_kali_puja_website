import { bn } from './device';

/** What the visitor did tonight, for the line on their story card. */
const done = {
  lamps: 0,
  mala: false,
  ghosts: 0,
  roof: 0,
  baji: 0,
};

export const journal = {
  /** The 108 lamps of the opening, all lit. */
  lamps(n: number): void {
    done.lamps = Math.max(done.lamps, n);
  },
  mala(): void {
    done.mala = true;
  },
  ghosts(n: number): void {
    done.ghosts = Math.max(done.ghosts, n);
  },
  roof(n: number): void {
    done.roof = Math.max(done.roof, n);
  },
  /** One more piece set off on the বাজির রাত roof. */
  baji(n = 1): void {
    done.baji += n;
  },

  /** "১০৮টা প্রদীপ জ্বালালাম · মায়ের মালা গাঁথলাম · …", only what they really did. */
  lines(): string[] {
    const out: string[] = [];
    if (done.lamps) out.push(`${bn(done.lamps)}টা প্রদীপ জ্বালালাম`);
    if (done.mala) out.push('মায়ের মালা গাঁথলাম');
    if (done.ghosts) out.push(`${bn(done.ghosts)}টা ভূত তাড়ালাম`);
    if (done.roof) out.push('ছাদে চোদ্দ প্রদীপ দিলাম');
    if (done.baji) out.push(`${bn(done.baji)}টা বাজি পোড়ালাম`);
    return out;
  },
};
