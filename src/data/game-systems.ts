export interface GameSystem {
  slug: string;
  label: string;
  description: string;
  href: string;
}

export const GAME_SYSTEMS: GameSystem[] = [
  {
    slug: 'gurps',
    label: 'GURPS',
    description: 'Generic Universal RolePlaying System — the mechanical backbone of Aletheia.',
    href: '/systems/gurps',
  },
];
