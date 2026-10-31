// Map registry. Add a map: create a data file next to this one and list it in MAPS.
// MAPS are the lobby's maps. The tutorial plays on its own map (TRAINING_MAP): the
// original 40 × 28 m Almacén, kept as it was because the lessons (config/lessons.js)
// and the mechanics tests are written on its coordinates. ALL_MAPS: every map by id.
import warehouse from './warehouse.js';
import hotel from './hotel.js';
import port from './port.js';
import forest from './forest.js';
import embassy from './embassy.js';
import training from './training.js';

export const MAPS = Object.freeze({
  warehouse,
  hotel,
  port,
  forest,
  embassy,
});

export const TRAINING_MAP = 'training';
export const ALL_MAPS = Object.freeze({ ...MAPS, training });

export const DEFAULT_MAP = 'warehouse';
