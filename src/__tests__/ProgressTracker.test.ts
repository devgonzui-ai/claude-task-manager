import { ProgressTracker } from '../lib/ProgressTracker';
import { I18n } from '../lib/i18n';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('ProgressTracker', () => {
  let tempDir: string;
  let taskFile: string;
  let i18n: I18n;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-tracker-test-'));
    taskFile = path.join(tempDir, 'task.md');
    i18n = I18n.getInstance();
    await i18n.init('en');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  const write = async (content: string) => fs.writeFile(taskFile, content);

  describe('getProgress', () => {
    it('should throw when task.md does not exist', async () => {
      const tracker = new ProgressTracker(taskFile, i18n);
      await expect(tracker.getProgress()).rejects.toThrow('No task.md file found');
    });

    it('should parse the title from the first H1 heading', async () => {
      await write('# My Feature\n\n## Tasks\n- [ ] do it\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const result = await tracker.getProgress();
      expect(result.title).toBe('My Feature');
    });

    it('should default the title when there is no H1 heading', async () => {
      await write('## Tasks\n- [ ] do it\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const result = await tracker.getProgress();
      expect(result.title).toBe('Untitled Task');
    });

    it('should count completed and pending checkboxes', async () => {
      await write('# T\n- [x] one\n- [X] two\n- [ ] three\n- [ ] four\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const result = await tracker.getProgress();

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.percentage).toBe(50);
      expect(result.tasks).toHaveLength(4);
      expect(result.tasks[0]).toEqual({ completed: true, text: 'one' });
      expect(result.tasks[2]).toEqual({ completed: false, text: 'three' });
    });

    it('should treat uppercase [X] as completed', async () => {
      await write('# T\n- [X] done\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const result = await tracker.getProgress();
      expect(result.completed).toBe(1);
      expect(result.percentage).toBe(100);
    });

    it('should report 0% when there are no checkboxes', async () => {
      await write('# T\n\nJust prose, no checkboxes here.\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const result = await tracker.getProgress();
      expect(result.total).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('should round the percentage to the nearest integer', async () => {
      // 1 of 3 -> 33.33 -> 33
      await write('# T\n- [x] a\n- [ ] b\n- [ ] c\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const result = await tracker.getProgress();
      expect(result.percentage).toBe(33);
    });
  });

  describe('setCompletion', () => {
    it('should throw when task.md does not exist', async () => {
      const tracker = new ProgressTracker(taskFile, i18n);
      await expect(tracker.setCompletion([1], true)).rejects.toThrow('No task.md file found');
    });

    it('should mark the given 1-based checkboxes as done', async () => {
      await write('# T\n- [ ] a\n- [ ] b\n- [ ] c\n');
      const tracker = new ProgressTracker(taskFile, i18n);

      const { updated, invalid, result } = await tracker.setCompletion([1, 3], true);

      expect(updated).toEqual([1, 3]);
      expect(invalid).toEqual([]);
      expect(result.completed).toBe(2);

      const content = await fs.readFile(taskFile, 'utf8');
      expect(content).toContain('- [x] a');
      expect(content).toContain('- [ ] b');
      expect(content).toContain('- [x] c');
    });

    it('should uncheck boxes when completed is false', async () => {
      await write('# T\n- [x] a\n- [x] b\n');
      const tracker = new ProgressTracker(taskFile, i18n);

      const { updated, result } = await tracker.setCompletion([2], false);

      expect(updated).toEqual([2]);
      expect(result.completed).toBe(1);
      const content = await fs.readFile(taskFile, 'utf8');
      expect(content).toContain('- [x] a');
      expect(content).toContain('- [ ] b');
    });

    it('should report out-of-range numbers as invalid and not change the file', async () => {
      await write('# T\n- [ ] a\n- [ ] b\n');
      const tracker = new ProgressTracker(taskFile, i18n);

      const { updated, invalid } = await tracker.setCompletion([5, 0], true);

      expect(updated).toEqual([]);
      expect(invalid).toEqual([5, 0]);
      const content = await fs.readFile(taskFile, 'utf8');
      expect(content).toContain('- [ ] a');
      expect(content).toContain('- [ ] b');
    });

    it('should preserve indentation of nested checkboxes', async () => {
      await write('# T\n- [ ] a\n  - [ ] nested\n');
      const tracker = new ProgressTracker(taskFile, i18n);

      await tracker.setCompletion([2], true);

      const content = await fs.readFile(taskFile, 'utf8');
      expect(content).toContain('  - [x] nested');
    });
  });

  describe('formatProgressBar', () => {
    it('should render a full bar at 100%', () => {
      const tracker = new ProgressTracker(taskFile, i18n);
      expect(tracker.formatProgressBar(100, 10)).toBe('█'.repeat(10));
    });

    it('should render an empty bar at 0%', () => {
      const tracker = new ProgressTracker(taskFile, i18n);
      expect(tracker.formatProgressBar(0, 10)).toBe('░'.repeat(10));
    });

    it('should keep the bar at the requested width', () => {
      const tracker = new ProgressTracker(taskFile, i18n);
      const bar = tracker.formatProgressBar(50, 20);
      expect(bar.length).toBe(20);
      expect(bar).toBe('█'.repeat(10) + '░'.repeat(10));
    });
  });

  describe('formatOutput', () => {
    it('should use the localized header and count (English)', async () => {
      await i18n.init('en');
      await write('# Feature\n- [x] a\n- [ ] b\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const out = tracker.formatOutput(await tracker.getProgress());

      expect(out).toContain('📊 Task Progress: Feature');
      expect(out).toContain('(1/2 tasks)');
      expect(out).toContain('50%');
    });

    it('should use the localized header and count (Japanese)', async () => {
      await i18n.init('ja');
      await write('# 機能\n- [x] a\n- [ ] b\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const out = tracker.formatOutput(await tracker.getProgress());

      expect(out).toContain('📊 タスク進捗: 機能');
      expect(out).toContain('(1/2 件)');
      // Regression guard: the header must never leak the raw i18n key.
      expect(out).not.toContain('commands.progress');
    });

    it('should show the localized empty-state message when there are no checkboxes', async () => {
      await i18n.init('en');
      await write('# Empty\n\nnothing to track\n');
      const tracker = new ProgressTracker(taskFile, i18n);
      const out = tracker.formatOutput(await tracker.getProgress());
      expect(out).toContain('No subtasks found');
    });
  });
});
