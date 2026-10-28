// El lobby antes de jugar (session/Lobby.js): formato, bando y mapa; después la selección de clases por puesto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLobby, lobbySet, lobbyStart, savedLobby, canPick, canAdd, openPick, pickSides, pickMissing, freeSlot, DEFAULT_ROLES } from '../src/session/Lobby.js';

test('por defecto: mejor de 3, atacando, las clases de siempre', () => {
  const l = createLobby();
  assert.equal(l.view, 'main');
  assert.equal(l.bestOf, 3);
  assert.equal(l.side, 'attackers');
  assert.deepEqual(l.roles, { attackers: [...DEFAULT_ROLES.attackers], defenders: [...DEFAULT_ROLES.defenders] });
  assert.deepEqual(lobbyStart(l), { mode: 'match', team: 'attackers', bestOf: 3, map: 'warehouse' });
});

test('una ronda suelta es el modo de siempre (con reintentos); 3, 5 y 7 son partidas', () => {
  const l = createLobby();
  assert.ok(lobbySet(l, 'bestOf_1'));
  assert.equal(lobbyStart(l).mode, 'play');
  assert.ok(lobbySet(l, 'bestOf_7'));
  assert.equal(lobbyStart(l).bestOf, 7);
  assert.equal(lobbySet(l, 'bestOf_4'), false);
  assert.ok(lobbySet(l, 'side_defenders'));
  assert.equal(lobbyStart(l).team, 'defenders');
});

test('las clases respetan los límites: una Brecha, un Explorador, un Trampero', () => {
  const l = createLobby();
  assert.equal(canPick(l, 'attackers', 0, 'scout'), false, 'el Explorador ya está en otro puesto');
  assert.equal(lobbySet(l, 'role_attackers_0_scout'), false);
  assert.ok(lobbySet(l, 'role_attackers_2_assault'));
  assert.ok(lobbySet(l, 'role_attackers_0_scout'), 'ahora sí');
  assert.equal(lobbySet(l, 'role_defenders_0_trapper'), false);
  assert.ok(lobbySet(l, 'role_defenders_0_anchor') === false, 'ya la tiene');
  assert.equal(lobbySet(l, 'role_defenders_1_anchor'), true, 'dos Anclas se pueden');
  assert.equal(lobbySet(l, 'role_defenders_2_anchor'), false, 'tres no');
  assert.equal(lobbySet(l, 'role_attackers_0_anchor'), false, 'un atacante no es Ancla');
});

test('un cambio quita el "listo"; lo guardado vuelve, lo raro no', () => {
  const l = createLobby();
  l.ready = true;
  lobbySet(l, 'bestOf_5');
  assert.equal(l.ready, false);
  const back = createLobby(JSON.parse(JSON.stringify(savedLobby(l))));
  assert.equal(back.bestOf, 5);
  assert.deepEqual(createLobby({ bestOf: 9, side: 'x', roles: { attackers: ['scout', 'scout', 'scout'] } }), createLobby());
});

test('la selección de clases abre en el bando con que empiezas; en una partida se eligen ambos', () => {
  const l = createLobby();
  lobbySet(l, 'side_defenders');
  openPick(l);
  assert.equal(l.view, 'pick');
  assert.equal(l.pickSide, 'defenders');
  assert.deepEqual(pickSides(l), ['defenders', 'attackers']);
  lobbySet(l, 'pickSide_attackers');
  assert.equal(l.pickSide, 'attackers');
  lobbySet(l, 'bestOf_1');
  openPick(l);
  assert.deepEqual(pickSides(l), ['defenders'], 'una ronda suelta: solo tu bando');
  lobbySet(l, 'pickSide_attackers');
  assert.equal(l.pickSide, 'defenders');
});

test('el roster: se quitan y se añaden personajes del grupo hasta tener 3, con sus límites', () => {
  const l = createLobby();
  openPick(l);
  assert.equal(pickMissing(l), null, 'empieza con la escuadra guardada');
  assert.equal(canAdd(l, 'attackers', 'assault'), false, 'llena: no cabe nadie más');
  assert.ok(lobbySet(l, 'remove_attackers_1'));
  assert.deepEqual(l.roles.attackers, ['assault', null, 'scout']);
  assert.equal(freeSlot(l, 'attackers'), 1);
  assert.equal(pickMissing(l), 'attackers');
  assert.equal(lobbySet(l, 'remove_attackers_1'), false, 'ya está libre');
  assert.equal(lobbySet(l, 'add_attackers_scout'), false, 'un solo Explorador');
  assert.equal(lobbySet(l, 'add_attackers_anchor'), false, 'el Ancla no ataca');
  assert.ok(lobbySet(l, 'add_attackers_assault'), 'dos Asaltantes sí');
  assert.deepEqual(l.roles.attackers, ['assault', 'assault', 'scout']);
  assert.equal(pickMissing(l), null);
  lobbySet(l, 'remove_defenders_0');
  lobbySet(l, 'remove_defenders_2');
  assert.equal(pickMissing(l), 'defenders', 'en una partida faltan los de la defensa');
  assert.ok(lobbySet(l, 'add_defenders_roamer'));
  assert.ok(lobbySet(l, 'add_defenders_defender'));
  assert.deepEqual(l.roles.defenders, ['roamer', 'defender', 'defender']);
  lobbySet(l, 'bestOf_1');
  lobbySet(l, 'remove_defenders_0');
  assert.equal(pickMissing(l), null, 'una ronda suelta atacando: solo cuenta tu bando');
});

test('el roster: mirar un personaje solo cambia la pantalla; una escuadra incompleta no se guarda', () => {
  const l = createLobby();
  assert.equal(l.inspect.attackers, 'assault');
  assert.equal(lobbySet(l, 'inspect_attackers_entry'), false, 'nada que guardar');
  assert.equal(l.inspect.attackers, 'entry');
  lobbySet(l, 'inspect_attackers_trapper');
  assert.equal(l.inspect.attackers, 'entry', 'el Trampero no está en el grupo atacante');
  lobbySet(l, 'remove_attackers_0');
  assert.deepEqual(createLobby(JSON.parse(JSON.stringify(savedLobby(l)))).roles.attackers, [...DEFAULT_ROLES.attackers]);
});

test('el mapa: uno de la lista o al azar; el azar se sortea al pasar a las clases y se recuerda la elección', () => {
  const l = createLobby();
  assert.equal(l.map, 'warehouse');
  assert.ok(lobbySet(l, 'map_hotel'));
  assert.equal(lobbySet(l, 'map_hotel'), false, 'ya estaba');
  assert.equal(lobbySet(l, 'map_luna'), false, 'no existe');
  l.view = 'lobby';
  openPick(l);
  assert.equal(lobbyStart(l).map, 'hotel');
  assert.ok(lobbySet(l, 'map_random'));
  openPick(l, () => 0.99);
  assert.equal(l.drawn, 'hotel');
  assert.equal(lobbyStart(l).map, 'hotel');
  openPick(l, () => 0);
  assert.equal(lobbyStart(l).map, 'warehouse');
  assert.equal(createLobby(savedLobby(l)).map, 'random', 'se guarda "al azar", no el mapa sorteado');
  assert.equal(createLobby({ map: 'luna' }).map, 'warehouse');
});
