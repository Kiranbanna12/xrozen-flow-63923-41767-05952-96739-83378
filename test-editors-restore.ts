import { loadEnvironmentConfig } from './src/server/utils/env.util.ts';
import { JWTService } from './src/lib/database/services/jwt.service.ts';

async function testEditorsAPI() {
  loadEnvironmentConfig();
  const jwtService = new JWTService();
  
  // Generate a test token
  const token = jwtService.generateToken({ 
    userId: 'test-user-123', 
    email: 'test@example.com' 
  });
  
  console.log('🧪 Testing editors API...');
  
  // Test editors endpoint
  try {
    const response = await fetch('http://localhost:3001/api/editors', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📊 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Editors data:', data);
      console.log('📈 Number of editors:', data.data?.length || 0);
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }
  } catch (error) {
    console.log('❌ Fetch error:', error);
  }
}

testEditorsAPI();