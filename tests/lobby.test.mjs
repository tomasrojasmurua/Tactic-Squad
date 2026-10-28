// El lobby antes de jugar (session/Lobby.js): formato, bando, clases por puesto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLobby, lobbySet, lobbyStart, savedLobby, canPick, DEFAULT_ROLES } from '../src/session/Lobby.js';

test('por defecto: mejor de 3, atacando, las clases de siempre', () => {
  const l = createLobby();
  assert.equal(l.view, 'main');
  assert.equal(l.bestOf, 3);
  assert.equal(l.side, 'attackers');
  assert.deepEqual(l.roles, { attackers: [...DEFAULT_ROLES.attackers], defenders: [...DEFAULT_ROLES.defenders] });
  assert.deepEqual(lobbyStart(l), { mode: 'match', team: 'attackers', bestOf: 3 });
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
