const test = require('node:test');
const assert = require('node:assert/strict');

const apiRoutes = require('../routes');
const roomRoutes = require('../routes/roomRoutes');

const getRegisteredRoutes = (router) => router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods).filter((method) => layer.route.methods[method])
  }));

test('RoomSync API exposes its compatibility health endpoint', () => {
  const health = getRegisteredRoutes(apiRoutes).find((route) => route.path === '/health');
  assert.ok(health, 'GET /api/health must be registered');
  assert.ok(health.methods.includes('get'));
});

test('owner room management routes are registered with the expected methods', () => {
  const routes = getRegisteredRoutes(roomRoutes);
  const expected = [
    ['/:roomId/room-number', 'patch'],
    ['/:roomId/members', 'get'],
    ['/requests/:ownerId', 'get'],
    ['/requests/remove', 'post']
  ];

  for (const [path, method] of expected) {
    const route = routes.find((candidate) => candidate.path === path);
    assert.ok(route, `Expected ${path} to be registered`);
    assert.ok(route.methods.includes(method), `Expected ${method.toUpperCase()} ${path}`);
  }
});
