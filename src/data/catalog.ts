import rawCatalog from './catalog.json';
import type { Game } from '../types';

export const localCatalog: Game[] = rawCatalog as Game[];

export default localCatalog;
