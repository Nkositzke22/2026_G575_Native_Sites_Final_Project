window.onload = function() {
    const container = document.getElementById('map-container');
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const paramCheckbox = document.getElementById("layer-param");
    const paramGroup = document.querySelector(".layer-param-group");
    const paramSelect = document.getElementById("param-aggregate-select");

    paramSelect.style.display = paramCheckbox.checked ? "block" : "none";

    // initial state
    if (paramCheckbox.checked) {
        paramGroup.classList.add("active");
    }

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
    const subBasinG = map.append("g").attr("id", "subbasin-layer");
    const paramMoundG = map.append("g").attr("id", "param-mounds"); // keep last for drawing it on top?

    const promises = [
        d3.json("data/mound_sites.json"),
        d3.json("data/wisconsin.topojson"),
        d3.json("data/sub-basin-mound-aggregate.geojson")
    ];

    Promise.all(promises).then(function(data) {
        const moundData = data[0];
        const topoData = data[1];
        const subbasinData = data[2];

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

        // [PARAM'S CODE - Proportions Aggregation]

        subBasinG.selectAll(".subbasin")
            .data(subbasinData.features)
            .enter()
            .append("path")
            .attr("class", "subbasin")
            .attr("d", path)
            .style("fill", "#3498db")
            .style("stroke", "#1f2d3a")
            .style("stroke-width", 0.5)
            .style("opacity", 0.3)
            .on("click", function(event, d) {
                showPopup(event, d.properties);
            });

        updateSubbasinVisibility();

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

    paramCheckbox.addEventListener("change", function () {

        paramGroup.classList.toggle("active", this.checked);

        if (!this.checked) {
            paramSelect.value = "";
        }

        updateSubbasinVisibility();
    });

    paramSelect.addEventListener("change", function () {
        updateSubbasinVisibility();
    });

    function updateSubbasinVisibility() {

        if (!paramCheckbox.checked) {
            subBasinG.selectAll(".subbasin")
                .transition()
                .duration(200)
                .style("opacity", 0.0);
            return;
        }

        if (paramSelect.value === "huc8") {
            subBasinG.selectAll(".subbasin")
                .transition()
                .duration(300)
                .style("opacity", 0.6);
        } else {
            subBasinG.selectAll(".subbasin")
                .transition()
                .duration(200)
                .style("opacity", 0.0);
        }
    }

    function showPopup(event, props) {
        const popup = document.getElementById("popup");
        const title = document.getElementById("popup-title");
        const container = d3.select("#popup-chart");
        const tooltip = d3.select("#pie-tooltip");
        const [x, y] = d3.pointer(event);

        popup.classList.remove("hidden");

        popup.style.left = (event.pageX + 15) + "px";
        popup.style.top = (event.pageY + 15) + "px";

        title.textContent = props.HUC8_NAME;

        container.selectAll("*").remove();

        const species = [
            "Bird",
            "Fork Tailed Bird",
            "Goose",
            "Bear",
            "Panther",
            "Long Tailed Quadruped",
            "Short Tailed Quadruped",
            "Unknown Quadruped",
            "Water Spirit",
            "Long Tailed Turtle",
            "Short Tailed Turtle",
            "No Tailed Turtle",
            "Unknown Turtle",
            "Mink"
        ];

        const data = species
            .map(k => ({ key: k, value: +props[k] || 0 }))
            .filter(d => d.value > 0);

        const width = 240;
        const height = 240;
        const radius = Math.min(width, height) / 2;

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width/2},${height/2})`);

        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.key))
            .range(d3.schemeTableau10);

        const pie = d3.pie().value(d => d.value);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);

        svg.selectAll("path")
            .data(pie(data))
            .enter()
            .append("path")
            .attr("d", arc)
            .attr("fill", d => color(d.data.key))
            .attr("stroke", "#2c3e50")
            .style("stroke-width", "1px")
            .on("mouseover", function(event, d) {

                d3.select(this)
                    .style("opacity", 0.7)
                    .style("stroke-width", "2px");

                tooltip
                    .classed("hidden", false)
                    .text(`${d.data.key}: ${d.data.value}`);
            })
            .on("mousemove", function(event) {

                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px");
            })
            .on("mouseout", function() {

                d3.select(this)
                    .style("opacity", 1)
                    .style("stroke-width", "1px");

                tooltip.classed("hidden", true);
            });
    }

    document.getElementById("popup-close").addEventListener("click", function () {
        document.getElementById("popup").classList.add("hidden");
    });
};