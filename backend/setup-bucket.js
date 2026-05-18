const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function setupBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError);
    return;
  }
  
  const bucketExists = buckets.some(b => b.name === 'audio-uploads');
  if (!bucketExists) {
    console.log('Creating audio-uploads bucket...');
    const { error: createError } = await supabase.storage.createBucket('audio-uploads', {
      public: false,
    });
    if (createError) {
      console.error('Error creating bucket:', createError);
    } else {
      console.log('Bucket audio-uploads created successfully.');
    }
  } else {
    console.log('Bucket audio-uploads already exists.');
  }
}

setupBucket();
