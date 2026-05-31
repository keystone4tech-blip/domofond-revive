async function testDaData() {
  const token = "ffc54d5b244795b5463f82cb8dcfbb1eb4f46ff7";
  const body = {
    query: "Главная",
    count: 5,
    locations: [
      { region_kladr_id: "23" },
      { region_kladr_id: "01" }
    ],
    from_bound: { value: "street" },
    to_bound: { value: "street" }
  };

  try {
    const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Token ${token}`
      },
      body: JSON.stringify(body)
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Suggestions count:", data.suggestions ? data.suggestions.length : 0);
    if (data.suggestions && data.suggestions.length > 0) {
      console.log("First suggestion:", data.suggestions[0].value);
    } else {
      console.log("Response:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testDaData();
