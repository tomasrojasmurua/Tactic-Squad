// Map registry. Add a map: create a data file next to this one and list it.
import warehouse from './warehouse.js';
import hotel from './hotel.js';
import port from './port.js';

export const MAPS = Object.freeze({
  warehouse,
  hotel,
  port,
});

export const DEFAULT_MAP = 'warehouse';
