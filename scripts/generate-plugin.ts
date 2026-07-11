/**
 * Generates the Claude Code plugin package (plugin/) and the marketplace
 * manifest (.claude-plugin/marketplace.json) from the same sources used by
 * `claude-task init`, so the plugin and init-based distribution never drift.
 *
 * Run with: npm run generate:plugin
 * The plugin.test.ts suite fails if the checked-in files are out of date.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  CustomCommandGenerator,
  SESSION_START_HOOK_ENTRY
} from '../src/lib/CustomCommandGenerator';
import { I18n } from '../src/lib/i18n';

const repoRoot = path.join(__dirname, '..');
const pluginDir = path.join(repoRoot, 'plugin');

export interface PluginFiles {
  pluginManifest: Record<string, unknown>;
  marketplaceManifest: Record<string, unknown>;
  hooksConfig: Record<string, unknown>;
  mcpConfig: Record<string, unknown>;
  commandContent: string;
  skillContent: string;
}

export function buildPluginFiles(): PluginFiles {
  const pkg = fs.readJsonSync(path.join(repoRoot, 'package.json'));
  const repoUrl = 'https://github.com/devgonzui-ai/claude-task-manager';
  const generator = new CustomCommandGenerator(repoRoot, I18n.getInstance());

  const pluginManifest = {
    name: 'claude-task',
    displayName: 'Claude Task Manager',
    version: pkg.version,
    description: pkg.description,
    author: { name: pkg.author },
    homepage: repoUrl,
    repository: repoUrl,
    license: pkg.license,
    keywords: ['task', 'task-management', 'mcp', 'cli']
    // hooks/hooks.json and .mcp.json are auto-loaded from their standard
    // locations; referencing them from the manifest makes Claude Code load
    // them twice and fail ("Duplicate hooks file detected").
  };

  const marketplaceManifest = {
    name: 'gonzui-tools',
    owner: { name: pkg.author },
    plugins: [
      {
        name: 'claude-task',
        source: './plugin',
        displayName: 'Claude Task Manager',
        description: pkg.description,
        version: pkg.version,
        author: { name: pkg.author },
        homepage: repoUrl,
        repository: repoUrl,
        license: pkg.license,
        keywords: ['task', 'task-management', 'mcp', 'cli']
      }
    ]
  };

  // Plugin hooks use the grouped format from the plugin docs (an entry with a
  // nested `hooks` array), unlike the flat entries merged into settings.json
  // by `init --hooks`. The command itself is shared via the exported constant.
  const hooksConfig = {
    hooks: {
      SessionStart: [
        {
          hooks: [{ ...SESSION_START_HOOK_ENTRY }]
        }
      ]
    }
  };

  // npx keeps the plugin working without a global npm install; cwd must be the
  // project so TaskManager resolves the project's task.md.
  const mcpConfig = {
    mcpServers: {
      'claude-task': {
        command: 'npx',
        args: ['-y', '-p', pkg.name, 'claude-task-mcp'],
        cwd: '${CLAUDE_PROJECT_DIR}'
      }
    }
  };

  return {
    pluginManifest,
    marketplaceManifest,
    hooksConfig,
    mcpConfig,
    commandContent: generator.generateCustomCommandContent(),
    skillContent: generator.generateSkillContent()
  };
}

async function main(): Promise<void> {
  const files = buildPluginFiles();

  await fs.ensureDir(path.join(pluginDir, '.claude-plugin'));
  await fs.ensureDir(path.join(pluginDir, 'commands'));
  await fs.ensureDir(path.join(pluginDir, 'skills', 'task'));
  await fs.ensureDir(path.join(pluginDir, 'hooks'));
  await fs.ensureDir(path.join(repoRoot, '.claude-plugin'));

  await fs.writeJson(path.join(pluginDir, '.claude-plugin', 'plugin.json'), files.pluginManifest, { spaces: 2 });
  await fs.writeJson(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), files.marketplaceManifest, { spaces: 2 });
  await fs.writeJson(path.join(pluginDir, 'hooks', 'hooks.json'), files.hooksConfig, { spaces: 2 });
  await fs.writeJson(path.join(pluginDir, '.mcp.json'), files.mcpConfig, { spaces: 2 });
  await fs.writeFile(path.join(pluginDir, 'commands', 'task.md'), files.commandContent);
  await fs.writeFile(path.join(pluginDir, 'skills', 'task', 'SKILL.md'), files.skillContent);

  console.log('Generated plugin/ and .claude-plugin/marketplace.json');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
