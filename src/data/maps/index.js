// Map registry. Add a map: create a data file next to this one and list it.
import warehouse from './warehouse.js';
import hotel from './hotel.js';

export const MAPS = Object.freeze({
  warehouse,
  hotel,
});

export const DEFAULT_MAP = 'warehouse';
