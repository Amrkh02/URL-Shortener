process.env.SQLITE_FILE = ':memory:';
process.env.ADMIN_TOKEN = 'testtoken';

const request = require('supertest');
const app = require('../server');

describe('URL Shortener API', () => {
  let shortId;

  test('shorten a url', async () => {
    const res = await request(app).post('/api/shorten').send({ url: 'https://example.com/long' }).expect(200);
    expect(res.body.shortId).toBeDefined();
    shortId = res.body.shortId;
  });

  test('generate returns an id', async () => {
    const res = await request(app).get('/api/generate').expect(200);
    expect(res.body.shortId).toBeDefined();
  });

  test('resolve returns original without redirect', async () => {
    const res = await request(app).post('/api/resolve').send({ short: shortId }).expect(200);
    expect(res.body.short_id).toBeDefined();
    expect(res.body.long_url).toBe('https://example.com/long');
  });

  test('redirect increments clicks and logs analytics', async () => {
    await request(app).get(`/${shortId}`).expect(301);
    const info = await request(app).get(`/api/info/${shortId}`).expect(200);
    expect(info.body.clicks).toBeGreaterThanOrEqual(1);
  });

  test('analytics requires admin token and returns data with valid token', async () => {
    await request(app).get(`/api/analytics/${shortId}`).expect(401);

    const res = await request(app).get(`/api/analytics/${shortId}`).set('x-admin-token', 'testtoken').expect(200);
    expect(res.body.info).toBeDefined();
    expect(Array.isArray(res.body.recent)).toBe(true);
  });
});