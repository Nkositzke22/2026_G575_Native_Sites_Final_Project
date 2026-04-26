window.onload = function() {
    const container = document.getElementById('map-container');
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const map = d3.select("#map-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    const projection = d3.geoAlbers()
        .center([0, 44.75])
        .rotate([90, 0, 0])
        .parallels([43, 46])
        .scale(width * 8)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // TEAM LAYERS
    const nickVegG = map.append("g").attr("id", "nick-vegetation");
    const chanCatchG = map.append("g").attr("id", "chanodom-catchment"); 
    const boundaryG = map.append("g").attr("id", "wi-boundary-layer");
    const chanLcaG = map.append("g").attr("id", "chanodom-lca");       
    const paramMoundG = map.append("g").attr("id", "param-mounds");

    const promises = [
        d3.json("data/mound_sites.json"),
        d3.json("data/wisconsin.topojson")
    ];

    Promise.all(promises).then(function(data) {
        const moundData = data[0];
        const topoData = data[1];

        const objectName = Object.keys(topoData.objects)[0];
        const wisconsin = topojson.feature(topoData, topoData.objects[objectName]);

        boundaryG.append("path")
            .datum(wisconsin)
            .attr("class", "wi-boundary")
            .attr("d", path);

        paramMoundG.selectAll(".mounds")
            .data(moundData.features)
            .enter()
            .append("path")
            .attr("class", "mounds")
            .attr("d", path.pointRadius(4)) 
            .on("click", function(event, d) {
                updateUI(d.properties, this);
            });

        // ==========================================
        // TEAM DATA IMPLEMENTATION START
        // ==========================================
        
        // [NICK'S CODE - Vegetation]

        // [CHANODOM'S CODE - Catchments/LCA]

        // [PARAM'S CODE - Proportional Symbols]

        // ==========================================

        d3.select("#stat-count").text(moundData.features.length);
    });

    function updateUI(p, element) {
        const animalKeys = [
            "Bird", "Fork Tailed Bird", "Goose", "Bear", "Panther", 
            "Long Tailed Quadruped", "Short Tailed Quadruped", "Unknown Quadruped",
            "Water Spirit", "Long Tailed Turtle", "Short Tailed Turtle", 
            "No Tailed Turtle", "Unknown Turtle", "Mink"
        ];

        let animalListHtml = "";
        animalKeys.forEach(key => {
            if (p[key] > 0) {
                animalListHtml += `<div class="stat-item"><span>${key}</span><strong>${Math.round(p[key])}</strong></div>`;
            }
        });

        const fullContent = `
            <div class="metadata-header">
                <h4>Site: ${p["Site Name"]}</h4>
                <p class="site-sub">${p.County} County</p>
            </div>
            <div class="meta-section">
                <p><strong>Landform:</strong> ${p.Landform}</p>
                <p><strong>Water:</strong> ${p.Water}</p>
                <p><strong>Locality:</strong> ${p.Locality}</p>
            </div>
            <div class="effigy-section">
                <h5>Effigy Counts</h5>
                <div class="stats-grid">${animalListHtml || '<p class="hint">No shapes recorded.</p>'}</div>
            </div>`;

        d3.select("#detail-content").html(fullContent);
        d3.selectAll(".mounds").style("opacity", 0.4).style("stroke", "white").style("stroke-width", "0.5px");
        d3.select(element).style("opacity", 1).style("stroke", "#f1c40f").style("stroke-width", "3px").raise();
    }

    const zoom = d3.zoom()
        .scaleExtent([1, 15])
        .on("zoom", (event) => {
            map.selectAll("g").attr("transform", event.transform);
            map.selectAll(".mounds").style("stroke-width", 0.5 / event.transform.k);
        });

    map.call(zoom);
};