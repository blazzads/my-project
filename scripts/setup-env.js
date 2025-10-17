/* Helps setup .env files for GLM-4.6 projects
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class EnvSetup {
  constructor() {
    this.projectRoot = process.cwd();
  }

  async init() {
    console.log('🔧 GLM-4.6 Environment Setup');
    console.log('==============================');
    console.log('Setup your .env files easily! 🎯\n');
  }

  async getEnvInfo() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    console.log('📋 Environment Configuration:');
    
    const apiKey = await question('🔑 ZAI API Key: ');
    const dbName = await question('🗄️  Database Name (strategic_proposal_db): ') || 'strategic_proposal_db';
    const dbUser = await question('👤 Database User (postgres): ') || 'postgres';
    const dbPassword = await question('🔒 Database Password: ');
    const nextAuthSecret = await question('🛡️  NextAuth Secret (press Enter for auto): ') || this.generateSecret();
    
    rl.close();

    return {
      apiKey,
      dbName,
      dbUser,
      dbPassword,
      nextAuthSecret
    };
  }

  generateSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  createEnvFile(envInfo, filename = '.env.local') {
    const content = `# GLM-4.6 API Configuration
ZAI_API_KEY=${envInfo.apiKey}
ZAI_BASE_URL=https://api.z.ai/v1

# Database
DATABASE_URL=postgresql://${envInfo.dbUser}:${envInfo.dbPassword}@localhost:5432/${envInfo.dbName}

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${envInfo.nextAuthSecret}

# Redis
REDIS_URL=redis://localhost:6379

# App Configuration
NODE_ENV=development
PORT=3000
`;

    const filePath = path.join(this.projectRoot, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    
    return filePath;
  }

  createExampleFile() {
    const exampleContent = `# GLM-4.6 API Configuration
ZAI_API_KEY=your_api_key_here
ZAI_BASE_URL=https://api.z.ai/v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/strategic_proposal_db

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Redis
REDIS_URL=redis://localhost:6379

# App Configuration
NODE_ENV=development
PORT=3000
`;

    const examplePath = path.join(this.projectRoot, '.env.example');
    fs.writeFileSync(examplePath, exampleContent, 'utf8');
    
    return examplePath;
  }

  updateGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    let gitignoreContent = '';

    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }

    const envIgnore = `
# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
`;

    if (!gitignoreContent.includes('.env.local')) {
      gitignoreContent += envIgnore;
      fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
      console.log('✅ Updated .gitignore');
    }
  }

  createBatchExportEnvs(envInfo) {
    // Create .env for batch export directory
    const batchDir = path.join(this.projectRoot, 'batch-export');
    if (fs.existsSync(batchDir)) {
      const batchEnv = `ZAI_API_KEY=${envInfo.apiKey}
ZAI_BASE_URL=https://api.z.ai/v1
`;
      fs.writeFileSync(path.join(batchDir, '.env'), batchEnv);
      console.log('✅ Created batch-export/.env');
    }
  }

  showNextSteps(envPath) {
    console.log('\n🎉 Environment setup complete!');
    console.log('================================');
    console.log(`📁 Created: ${envPath}`);
    console.log('📁 Created: .env.example');
    console.log('📁 Updated: .gitignore');
    
    console.log('\n🚀 Next steps:');
    console.log('1. Review your .env.local file');
    console.log('2. Start your development server:');
    console.log('   npm run dev');
    console.log('3. Test GLM-4.6 integration');
    
    console.log('\n📝 Important:');
    console.log('- Never commit .env.local to Git');
    console.log('- Keep your API keys secure');
    console.log('- Use different secrets for production');
  }

  async run() {
    try {
      await this.init();
      
      const envInfo = await this.getEnvInfo();
      
      // Create .env.local
      const envPath = this.createEnvFile(envInfo);
      console.log('✅ Created .env.local');
      
      // Create .env.example
      this.createExampleFile();
      console.log('✅ Created .env.example');
      
      // Update .gitignore
      this.updateGitignore();
      
      // Create batch export envs
      this.createBatchExportEnvs(envInfo);
      
      this.showNextSteps(envPath);

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const setup = new EnvSetup();
  setup.run();
}

module.exports = EnvSetup;