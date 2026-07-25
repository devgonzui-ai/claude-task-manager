import { TaskManager } from '../lib/TaskManager';
import { SnapshotWriter, SNAPSHOT_BEGIN, SNAPSHOT_END, MAX_SNAPSHOTS } from '../lib/SnapshotWriter';
import { I18n } from '../lib/i18n';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('Progress snapshots', () => {
  let tempDir: string;
  let manager: TaskManager;
  let taskFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-test-'));
    await I18n.getInstance().init('en');
    manager = new TaskManager(tempDir);
    await manager.init();
    taskFile = path.join(tempDir, 'task.md');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const read = async () => fs.readFile(taskFile, 'utf8');
  const write = async (content: string) => fs.writeFile(taskFile, content);
  const entries = (content: string) => {
    const begin = content.indexOf(SNAPSHOT_BEGIN);
    const end = content.indexOf(SNAPSHOT_END);
    if (begin === -1 || end === -1) {
      return [];
    }
    return content
      .slice(begin + SNAPSHOT_BEGIN.length, end)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '));
  };

  describe('writing', () => {
    it('creates the managed block with the progress line', async () => {
      await write('# Feature\n\n## Tasks\n- [x] one\n- [ ] two\n- [ ] three\n');

      const result = await manager.writeSnapshot();

      expect(result.written).toBe(true);
      const content = await read();
      expect(content).toContain(SNAPSHOT_BEGIN);
      expect(content).toContain(SNAPSHOT_END);
      expect(entries(content)).toHaveLength(1);
      expect(entries(content)[0]).toMatch(/^- \d{4}-\d{2}-\d{2} \d{2}:\d{2} — 1\/3 subtasks \(33%\)$/);
    });

    it('writes nothing when progress has not changed', async () => {
      await write('# Feature\n\n- [x] one\n- [ ] two\n');
      await manager.writeSnapshot();
      const afterFirst = await read();

      const result = await manager.writeSnapshot();

      expect(result.written).toBe(false);
      expect(await read()).toBe(afterFirst);
    });

    it('records a new line once a subtask is completed', async () => {
      await write('# Feature\n\n- [ ] one\n- [ ] two\n');
      await manager.writeSnapshot();

      await manager.setTaskCompletion([1], true);
      const result = await manager.writeSnapshot();

      expect(result.written).toBe(true);
      const recorded = entries(await read());
      expect(recorded).toHaveLength(2);
      expect(recorded[0]).toContain('0/2 subtasks (0%)');
      expect(recorded[1]).toContain('1/2 subtasks (50%)');
    });

    it('keeps only the most recent entries', async () => {
      const writer = new SnapshotWriter(taskFile);
      await write('# Feature\n\n- [ ] one\n- [ ] two\n- [ ] three\n');

      // Distinct timestamps and alternating counts so every call is a change.
      for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) {
        await manager.setTaskCompletion([1], i % 2 === 0);
        await writer.write(new Date(Date.UTC(2026, 0, 1, 0, i)));
      }

      const recorded = entries(await read());
      expect(recorded).toHaveLength(MAX_SNAPSHOTS);
      expect(recorded[recorded.length - 1]).toContain('2026-01-01');
    });

    it('leaves the surrounding task content untouched', async () => {
      const original = '# Feature\n\n## Tasks\n- [ ] one\n\n## Notes\nmy own notes\n';
      await write(original);

      await manager.writeSnapshot();

      const content = await read();
      expect(content.slice(0, content.indexOf(SNAPSHOT_BEGIN))).toBe(`${original}\n`);
      expect(content).toContain('my own notes');
    });

    it('appends into the existing block instead of duplicating it', async () => {
      await write('# Feature\n\n- [ ] one\n');
      await manager.writeSnapshot();
      await manager.setTaskCompletion([1], true);
      await manager.writeSnapshot();

      const content = await read();
      expect(content.split(SNAPSHOT_BEGIN)).toHaveLength(2);
      expect(content.split(SNAPSHOT_END)).toHaveLength(2);
    });
  });

  describe('safety', () => {
    it('does nothing when there is no task file', async () => {
      await fs.remove(taskFile);

      await expect(manager.writeSnapshot()).resolves.toEqual({ written: false });
    });

    it('does nothing when the task has no subtasks', async () => {
      const original = '# Feature\n\nNo checkboxes here.\n';
      await write(original);

      const result = await manager.writeSnapshot();

      expect(result.written).toBe(false);
      expect(await read()).toBe(original);
    });

    it('leaves a malformed block alone', async () => {
      const broken = `# Feature\n\n- [ ] one\n\n${SNAPSHOT_END}\nstray\n${SNAPSHOT_BEGIN}\n`;
      await write(broken);

      const result = await manager.writeSnapshot();

      expect(result.written).toBe(false);
      expect(await read()).toBe(broken);
    });

    it('never rejects, even when task.md is unreadable', async () => {
      await fs.remove(taskFile);
      await fs.ensureDir(taskFile);

      await expect(manager.writeSnapshot()).resolves.toEqual({ written: false });
    });
  });

  describe('multi-task mode', () => {
    it('snapshots the active task and preserves it across a switch', async () => {
      await manager.createNewTask({ title: 'Task A', name: 'a' });
      await write('# Task A\n\n- [x] a1\n- [ ] a2\n');
      await manager.writeSnapshot();

      await manager.createNewTask({ title: 'Task B', name: 'b' });
      await write('# Task B\n\n- [ ] b1\n');
      await manager.writeSnapshot();

      expect(entries(await read())).toHaveLength(1);
      expect(entries(await read())[0]).toContain('0/1 subtasks (0%)');

      await manager.switchTask('a');
      const restored = entries(await read());
      expect(restored).toHaveLength(1);
      expect(restored[0]).toContain('1/2 subtasks (50%)');
    });
  });
});
