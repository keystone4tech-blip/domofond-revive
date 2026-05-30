const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('http://localhost:3000', 'dummy', {
  global: {
    fetch: (url, options) => {
      console.log('Fetch URL Type:', typeof url);
      console.log('Fetch URL:', url);
      
      if (typeof url === 'string') {
        url = url.replace('/rest/v1/', '/');
      } else if (url instanceof URL) {
        url.pathname = url.pathname.replace('/rest/v1/', '/');
      }
      
      console.log('Modified URL:', url.toString());
      // we don't actually need to fetch, just exit
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
  }
});

supabase.from('profiles').select('*').eq('id', '123').then(console.log).catch(console.error);
