const token = "e2f68637298d357a2555d582480cddb18e671f6a";

async function testLocations(selectedCity, streetContext, queryText) {
  const body = {
    query: queryText,
    count: 7,
    locations: [
      { 
        region_kladr_id: "23", 
        city: selectedCity.replace(/^(г\.\s*|город\s*)/i, ""),
        street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
      },
      { 
        region_kladr_id: "01", 
        city: selectedCity.replace(/^(г\.\s*|город\s*)/i, ""),
        street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
      },
      {
        region_kladr_id: "23",
        street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
      },
      {
        region_kladr_id: "01",
        street: streetContext.replace(/(?:\(ул\)?|ул\.?|улица)\s*/gi, "").trim()
      }
    ],
    from_bound: { value: "house" },
    to_bound: { value: "house" }
  };

  try {
    const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Token ${token}`
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log(`City: "${selectedCity}", Query: "${queryText}" => Found: ${data.suggestions ? data.suggestions.length : 0}`);
    if (data.suggestions && data.suggestions.length > 0) {
      console.log("  Suggestions:", data.suggestions.map(s => s.value));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

async function runTests() {
  await testLocations("Новая Адыгея", "им. генерала Корнилова (ул)", "им. генерала Корнилова (ул)");
  await testLocations("г. Краснодар", "им. генерала Корнилова (ул)", "им. генерала Корнилова (ул)");
  await testLocations("Краснодар", "им. генерала Корнилова (ул)", "им. генерала Корнилова (ул)");
}

runTests();
