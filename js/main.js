window.onload = function() {
    const container = document.getElementById('map-container');
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;


    const splash = document.getElementById("splash-screen");
    const closeBtn = document.getElementById("close-splash");

    if (closeBtn) {
        closeBtn.addEventListener("click", function() {
            splash.classList.add("splash-hidden");
            
            setTimeout(() => {
                splash.style.display = "none";
            }, 500); 
        });
    }

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

    // Need this for the vegetation layer to show properly
    const defs = map.append("defs"); 

    const projection = d3.geoAlbers()
        .center([0, 44.75])
        .rotate([90, 0, 0])
        .parallels([43, 46])
        .scale(width * 8)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // TEAM LAYERS
    const boundaryG = map.append("g").attr("id", "wi-boundary-layer");
    const subBasinG = map.append("g").attr("id", "subbasin-layer");
    const chanClanG = map.append("g").attr("id", "chanodom-clan"); 
    
    // Veg layer fix
    const nickVegG = map.append("g")
        .attr("id", "nick-vegetation")
        .attr("clip-path", "url(#wi-clip)"); 

    const chanCatchG = map.append("g").attr("id", "chanodom-catchment");       
    const paramMoundG = map.append("g").attr("id", "param-mounds"); // Render above all other layers

    const promises = [
        d3.json("data/mound_sites_WI.json"),
        d3.json("data/wisconsin.topojson"),
        d3.json("data/sub-basin-mound-aggregate.geojson"),
        d3.json("data/clanTerritories.topojson"),
        d3.json("data/catchmentAreas2.geojson"),
        d3.json("data/wi_presettlement_veg.json") 
    ];

    Promise.all(promises).then(function(data) {
        const moundData = data[0];
        const topoData = data[1];
        const subbasinData = data[2];
        const clanTerritoriesData = data[3];
        const catchmentAreasData = data[4];
        const vegData = data[5]; 

        const objectName = Object.keys(topoData.objects)[0];
        const wisconsin = topojson.feature(topoData, topoData.objects[objectName]);

        // Veg layer workaround
        defs.append("clipPath")
            .attr("id", "wi-clip")
            .append("path")
            .datum(wisconsin)
            .attr("d", path);

        boundaryG.append("path")
            .datum(wisconsin)
            .attr("class", "wi-boundary")
            .attr("d", path);

        paramMoundG.selectAll(".mounds")
            .data(moundData.features)
            .enter()

            // Changed this section to get variable sizes when zooming 
            // -Chanodom
            .append("circle")
            .attr("cx", d => d.geometry ? projection(d.geometry.coordinates)[0] : 0)
            .attr("cy", d => d.geometry ? projection(d.geometry.coordinates)[1] : 0)
            .attr("r", 2.5)
            // 

            .attr("class", "mounds")
            .attr("d", path.pointRadius(4)) 
            .on("click", function(event, d) {
                updateUI(d.properties, this)
            });

        // ==========================================
        // TEAM DATA IMPLEMENTATION START
        // ==========================================
        
        // [NICK'S CODE - Vegetation]
        // Gemini: Implementation of filtered vegetation polygons with winding-order fix
        const meshName = Object.keys(vegData.objects)[0]; 
        const topoObject = vegData.objects[meshName];
        let vegFeatures = topojson.feature(vegData, topoObject).features;

        const realVegetation = vegFeatures.filter(d => {
            const area = d.properties.Shape_Area;
            return d.properties.CONSD_POLY && area < 40000000000;
        });

        // Gemini: Create color scale and legend logic for individual forest types
        const vegTypes = [...new Set(realVegetation.map(d => d.properties.CONSD_POLY))];
        const vegColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(vegTypes);

        nickVegG.selectAll(".veg-poly")
            .data(realVegetation)
            .enter()
            .append("path")
            .attr("class", "veg-poly")
            .attr("d", path)
            .style("fill", d => vegColorScale(d.properties.CONSD_POLY))
            .style("stroke", "none")
            .style("opacity", 0);

        // Populate Veg Legend
        const vegLegendItemsContainer = d3.select("#veg-legend-items");
        vegLegendItemsContainer.selectAll(".legend-item")
            .data(vegTypes)
            .enter()
            .append("div")
            .attr("class", "legend-item")
            .html(d => `
                <div class="legend-content">
                    <div class="legend-color" style="background-color: ${vegColorScale(d)}"></div>
                    <span>${d}</span>
                </div>
                <input type="checkbox" class="veg-toggle" value="${d}" checked>
            `);

        // Veg individual toggle listener
        d3.selectAll(".veg-toggle").on("change", function() {
            const selectedType = this.value;
            const isChecked = this.checked;
            const masterChecked = document.getElementById("layer-nick-veg").checked;

            nickVegG.selectAll(".veg-poly")
                .filter(d => d.properties.CONSD_POLY === selectedType)
                .transition()
                .duration(200)
                .style("opacity", (isChecked && masterChecked) ? 0.7 : 0);
        });

        console.log("Drawing " + realVegetation.length + " real forest patches.");


        // [CHANODOM'S CODE - Catchments/Clan Affiliation]

        const catchmentLabels = {
            14400: "4 Hours",
            86400: "24 Hours"
        };

        const catchmentColorScale = d3.scaleOrdinal()
            .domain([14400, 86400])
            .range(["#27ae60", "#a01616"]);

        // Renders catchments
        chanCatchG.selectAll(".catchment-feature")
            .data(catchmentAreasData.features)
            .enter()
            .append("path")
            .attr("class", "catchment-feature")
            .attr("d", path)
            .style("fill", "none")
            .style("stroke", d => {
                const val = +d.properties.level; // Forces a nunber
                const color = catchmentColorScale(val);
                return color ? d3.color(color).darker(1) : "#999";
            })            .style("stroke-width", 1.5)
            .style("opacity", 0);

        // Catchment legend
        const fixedTimes = [14400, 86400];
        const catchLegendItems = d3.select("#catchment-legend-items");

        catchLegendItems.selectAll(".legend-item")
            .data(fixedTimes)
            .enter()
            .append("div")
            .attr("class", "legend-item")
            .html(d => `
                <div class="legend-content">
                    <div class="legend-color" style="background-color: ${catchmentColorScale(d)}"></div>
                    <span>${catchmentLabels[d]}</span>
                </div>
            `);

        // Catchment legend event listeners
        d3.selectAll(".catchment-toggle").on("change", function() {
            const val = +this.value; // Convert string value to number
            const isChecked = this.checked;

            chanCatchG.selectAll(".catchment-feature")
                .filter(d => d.properties.level === val)
                .transition()
                .duration(200)
                .style("opacity", isChecked ? 0.5 : 0);
        });

        const clanObjects = Object.keys(clanTerritoriesData.objects)[0];
        const clanFeatures = topojson.feature(clanTerritoriesData, clanTerritoriesData.objects[clanObjects]);

        const clanColorScale = d3.scaleOrdinal(d3.schemeTableau10); // Will be used for random color palettes later

        // Loads clan features
        chanClanG.selectAll(".clan-feature")
            .data(clanFeatures.features)
            .enter()
            .append("path")
            .attr("class", "clan-feature")
            .attr("d", path)

            // Random color palette per feature
            .style("fill", d => clanColorScale(d.properties.Clan || "Unknown")) 

            // Prune stroke of "core" clan areas, double transparent overlays make them darker
            // Sets total territory stroke color to darker fill color 

            .style("stroke", d => {
                const type = String(d.properties["Area_Type"] || "").trim().toLowerCase();
                
                if (type === "core area") {
                    return "none";
                } else {
                    const fillColor = clanColorScale(d.properties.Clan || "Unknown");
                    return d3.color(fillColor).darker(1.2); 
                }
            })
            .style("stroke-width", d => {
                const type = String(d.properties["Area_Type"] || "").trim().toLowerCase();
                return type === "core area" ? 0 : 1;
            })
            
            .style("opacity", 0); // Initially hidden

        // Clan legend event listener & random color palette
        const uniqueClans = [...new Set(clanFeatures.features.map(d => d.properties.Clan || "Unknown"))];
        const clanLegendItemsContainer = d3.select("#legend-items");
                
        clanLegendItemsContainer.selectAll(".legend-item")
            .data(uniqueClans)
            .enter()
            .append("div")
            .attr("class", "legend-item")
            .html(d => `
                <div class="legend-content">
                    <div class="legend-color" style="background-color: ${clanColorScale(d)}"></div>
                    <span>${d}</span>
                </div>
                <input type="checkbox" class="clan-toggle" value="${d}" checked>
            `);

        // Clan legend symbols event listener
        d3.selectAll(".clan-toggle").on("change", function() {
            const selectedClan = this.value;
            const isChecked = this.checked;

            // Finds checked feature and fades in/out
            chanClanG.selectAll(".clan-feature")
                .filter(d => (d.properties.Clan || "Unknown") === selectedClan)
                .transition()
                .duration(200)
                .style("opacity", isChecked ? 0.6 : 0);
        });

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
        d3.selectAll(".mounds").style("opacity", 0.4).style("stroke", "white").style("stroke-width", "0.2px"); // Chanodom
        d3.select(element).style("opacity", 1).style("stroke", "#f1c40f").style("stroke-width", "0.5px").raise();
    }

    // I changed this function to increase clickability of sites when zoomed in
    // Chanodom
    const zoom = d3.zoom()
        .scaleExtent([1, 15])
        .on("zoom", (event) => {
            map.selectAll("g").attr("transform", event.transform);
            // map.selectAll(".mounds").style("stroke-width", 0.5 / event.transform.k);

            const transform = event.transform;
            
            paramMoundG.selectAll(".mounds")
                .attr("r", Math.max(1, 2 / Math.pow(transform.k, 1))) // This handles the scaling of the site symbols
                // .style("stroke-width", 0.5 / transform.k);
        });
    // 

    map.call(zoom);

    // Gemini: Vegetation event listener
    const nickVegCheckbox = document.getElementById("layer-nick-veg");
    const vegLegendContainer = document.getElementById("veg-legend");

    nickVegCheckbox.addEventListener("change", function() {
        if (this.checked) {
            vegLegendContainer.classList.remove("hidden");
            nickVegG.selectAll(".veg-poly")
                .transition()
                .duration(300)
                .style("opacity", d => {
                    const cb = document.querySelector(`.veg-toggle[value="${d.properties.CONSD_POLY}"]`);
                    return (cb && cb.checked) ? 0.7 : 0;
                });
        } else {
            vegLegendContainer.classList.add("hidden");
            nickVegG.selectAll(".veg-poly").transition().duration(200).style("opacity", 0);
        }
    });

    // Catchment event listeners
    const chanCatchCheckbox = document.getElementById("layer-chan-catchment");
    const catchLegendContainer = document.getElementById("catchment-legend");

    chanCatchCheckbox.addEventListener("change", function() {
        if (this.checked) {
            catchLegendContainer.classList.remove("hidden");
            
            // Turns on all catchment features
            chanCatchG.selectAll(".catchment-feature")
                .transition()
                .duration(300)
                .style("opacity", 0.5);
        } else {
            // Turns off all off catchment features
            chanCatchG.selectAll(".catchment-feature")
                .transition()
                .duration(200)
                .style("opacity", 0);
            
            catchLegendContainer.classList.add("hidden");
        }
    });

    // Clan event listeners
    const chanClanCheckbox = document.getElementById("layer-chan-clan");
    const clanLegendContainer = document.getElementById("clan-legend"); // Clan symbols legend

    chanClanCheckbox.addEventListener("change", function() {
        if (this.checked) {
            // Shows legend
            clanLegendContainer.classList.remove("hidden");
            
            // Layer fade in only if checked
            chanClanG.selectAll(".clan-feature")
                .transition()
                .duration(300)
                .style("opacity", function(d) {
                    const clanName = d.properties.Clan || "Unknown";
                    const checkbox = document.querySelector(`.clan-toggle[value="${clanName}"]`);
                    return (checkbox && checkbox.checked) ? 0.6 : 0;
                });
        } else {
            // Hides all clan features
            chanClanG.selectAll(".clan-feature")
                .transition()
                .duration(200)
                .style("opacity", 0.0);
            
            // Hides legend
            clanLegendContainer.classList.add("hidden");
        }
    });

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