import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createInvestigationJobAdapter, collectionJobName, queueConnection, type CollectionQueueTransport, type CollectionJobData } from '../src/adapters/investigation-jobs.js';
import type { QueueState } from '../src/modules/investigations/types.js';

test('queue connection preserves Redis URL routing, credentials, database and TLS', () => {
  const connection = queueConnection('rediss://queue-user:p%40ss%3Aword@redis.example.test:6380/2');
  assert.equal(connection.host, 'redis.example.test');
  assert.equal(connection.port, 6380);
  assert.equal(connection.username, 'queue-user');
  assert.equal(connection.password, 'p@ss:word');
  assert.equal(connection.db, 2);
  assert.deepEqual(connection.tls, { servername: 'redis.example.test' });
  assert.equal(connection.maxRetriesPerRequest, 1);
  const worker = queueConnection('redis://[::1]:6381', true);
  assert.equal(worker.host, '::1');
  assert.equal(worker.db, 0);
  assert.equal(worker.maxRetriesPerRequest, null);
  assert.equal(worker.tls, undefined);
  for (const value of ['http://localhost:6379', 'redis://localhost/not-a-db', 'redis://localhost/1?db=2']) {
    assert.throws(() => queueConnection(value));
  }
});

test('queue adapter deduplicates delivery and restarts only new request revisions', async () => {
  const id = randomUUID();
  let data: CollectionJobData | undefined;
  let state: QueueState = 'waiting';
  let retries = 0;
  let additions = 0;
  const transport: CollectionQueueTransport = {
    async getJob(jobId) {
      assert.equal(jobId, id);
      return data ? { data, async getState() { return state; }, async retry(_state, options) {
        assert.deepEqual(options, { resetAttemptsMade: true, resetAttemptsStarted: true });
        state = 'waiting'; retries++;
      } } : undefined;
    },
    async add(name, payload, options) {
      assert.equal(name, collectionJobName); assert.equal(options.jobId, id);
      assert.deepEqual(Object.keys(payload).sort(), ['dispatch_revision', 'investigation_id']);
      data = payload; additions++;
    },
    async getJobCounts() { return {}; }, async close() {},
  };
  const jobs = createInvestigationJobAdapter(transport);
  assert.equal(await jobs.enqueue(id, true, 'revision-one'), 'waiting');
  assert.equal(await jobs.enqueue(id, true, 'revision-one'), 'waiting');
  assert.equal(additions, 1);
  state = 'completed';
  assert.equal(await jobs.enqueue(id, false, 'collection-stage-revision'), 'completed');
  assert.equal(await jobs.enqueue(id, true, 'revision-one'), 'completed');
  assert.equal(retries, 0);
  state = 'failed';
  assert.equal(await jobs.enqueue(id, true, 'revision-one'), 'failed');
  assert.equal(retries, 0);
  assert.equal(await jobs.enqueue(id, true, 'revision-two'), 'waiting');
  assert.equal(retries, 1);
  // The worker, not the dispatching process, updates the revision. A crash
  // between requeue and worker startup cannot leave a falsely dispatched job.
  assert.equal(data!.dispatch_revision, 'revision-one');
  data = { investigation_id: id, dispatch_revision: 'revision-two' };
  state = 'failed';
  assert.equal(await jobs.enqueue(id, true, 'revision-two'), 'failed');
  assert.equal(retries, 1);
  // Enabling research can resume previously collected references, but an
  // exhausted research job must not be restarted without an owner retry.
  state = 'completed';
  assert.equal(await jobs.enqueue(id, false, 'collection-revision', true), 'waiting');
  assert.equal(retries, 2);
  state = 'failed';
  assert.equal(await jobs.enqueue(id, false, 'collection-revision', true), 'failed');
  assert.equal(retries, 2);
  await jobs.close();
});
