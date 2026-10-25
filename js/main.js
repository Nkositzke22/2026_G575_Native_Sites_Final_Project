window.onload = function () {

// ==========================================
// 1. GLOBAL CONSTANTS AND CONFIG
// ==========================================
const CONFIG = {
  projection: {
    center: [0, 44.75],
    rotate: [90, 0, 0],
    parallels: [43, 46],
    scaleMultiplier: 8          
  },
  data: {                       
    moundSites: "data/mound_sites2.json",
    wisconsinBoundary: "data/wisconsin.topojson",
    subBasinAggregate: "data/sub-basin-mound-aggregate.geojson",
    watershedAggregate: "data/watershed-mound-aggregate.geojson",
    subWatershedAggregate: "data/sub-watershed-mound-aggregate.geojson",
    clanTerritories: "data/clanTerritories.topojson",
    catchmentAreas: "data/catchmentAreas2.geojson",
    presettlementVeg: "data/wi_presettlement_veg2.topojson",
    otherStates: "data/other_states.geojson"
  },

  effigySpecies: [
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
  ],
  catchment: {                  
    labels: { 14400: "4 Hours", 86400: "24 Hours" },
    times: [14400, 86400],
    colorRange: ["#27ae60", "#a01616"]
  },
  search: {
    debounceMs: 150             
  }
};

// ==========================================
// 2. DOM ELEMENTS AND INITIALIZATION
// ==========================================
const container = document.getElementById("map-container");
const rect = container.getBoundingClientRect();
const width = rect.width;
const height = rect.height;

const splash = document.getElementById("splash-screen");
const closeBtn = document.getElementById("close-splash");
const openBtn = document.getElementById("open-splash");

const paramCheckbox = document.getElementById("layer-param");
const paramGroup = document.querySelector(".layer-param-group");
const paramSelect = document.getElementById("param-aggregate-select");


const siteSearchInput = document.getElementById("site-search");
const siteSearchResults = document.getElementById("site-search-results");

let aggregationLayers;              
let activeAggregation = null;       
let loadedMoundData = null;         
let searchDebounceTimer = null;

paramSelect.style.display = paramCheckbox.checked ? "block" : "none";
if (paramCheckbox.checked) paramGroup.classList.add("active"); 


const speciesColor = d3.scaleOrdinal()
  .domain(CONFIG.effigySpecies)
  .range(d3.schemeTableau10);

const map = d3.select("#map-container")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", `0 0 ${width} ${height}`);

const defs = map.append("defs");    

const projection = d3.geoAlbers()
  .center(CONFIG.projection.center)
  .rotate(CONFIG.projection.rotate)
  .parallels(CONFIG.projection.parallels)
  .scale(width * CONFIG.projection.scaleMultiplier)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);


const otherStatesG = map.append("g").attr("id", "other-states-layer");
const boundaryG = map.append("g").attr("id", "wi-boundary-layer");
const subBasinG = map.append("g").attr("id", "subbasin-layer");
const chanClanG = map.append("g").attr("id", "chanodom-clan");

const nickVegG = map.append("g")
  .attr("id", "nick-vegetation")
  .attr("clip-path", "url(#wi-clip)");

const chanCatchG = map.append("g").attr("id", "chanodom-catchment");
const paramMoundG = map.append("g").attr("id", "param-mounds"); 
const notesG = map.append("g").attr("id", "notes-layer");


const zoom = d3.zoom()
  .scaleExtent([1, 15])
  .on("zoom", (event) => {
    map.selectAll("g").attr("transform", event.transform);

    const transform = event.transform;
    paramMoundG.selectAll(".mounds")
      .attr("r", Math.max(1, 2 / Math.pow(transform.k, 1))); 

    notesG.selectAll(".note-marker").attr("r", Math.max(2, 5 / transform.k));
  });
map.call(zoom);


let isNoteMode = false;
const noteBtn = document.getElementById("toggle-note-mode");
const mapContainerEl = document.getElementById("map-container");
const tooltip = d3.select("#pie-tooltip");
const noteModal = document.getElementById("custom-note-modal");
const noteInput = document.getElementById("custom-note-input");
const submitNoteBtn = document.getElementById("submit-note-btn");
const cancelNoteBtn = document.getElementById("cancel-note-btn");

// ==========================================
// 3. DATA LAYERS
// ==========================================


function loadAllData() {
  return Promise.all([
    d3.json(CONFIG.data.moundSites),
    d3.json(CONFIG.data.wisconsinBoundary),
    d3.json(CONFIG.data.subBasinAggregate),
    d3.json(CONFIG.data.watershedAggregate),
    d3.json(CONFIG.data.subWatershedAggregate),
    d3.json(CONFIG.data.clanTerritories),
    d3.json(CONFIG.data.catchmentAreas),
    d3.json(CONFIG.data.presettlementVeg),
    d3.json(CONFIG.data.otherStates)
  ]);
}


function renderWisconsinBoundary(topoData) {
  const objectName = Object.keys(topoData.objects)[0];
  const wisconsin = topojson.feature(topoData, topoData.objects[objectName]);

  defs.append("clipPath")           
    .attr("id", "wi-clip")
    .append("path")
    .datum(wisconsin)
    .attr("d", path);

  boundaryG.append("path")         
    .datum(wisconsin)
    .attr("class", "wi-boundary")
    .attr("d", path);

  return wisconsin;
}


function renderOtherStatesLayer(otherStatesData) {
  otherStatesG.selectAll(".other-state")
    .data(otherStatesData.features)
    .enter()
    .append("path")
    .attr("class", "other-state")
    .attr("d", path)
    .style("fill", "#e0e0e0")
    .style("stroke", "#bdc3c7")
    .style("stroke-width", "1px");
}


function renderMoundSitesLayer(moundData) {
  paramMoundG.selectAll(".mounds")
    .data(moundData.features)
    .enter()
    .append("circle")

    
    .attr("cx", d => d.geometry ? projection(d.geometry.coordinates)[0] : 0)
    .attr("cy", d => d.geometry ? projection(d.geometry.coordinates)[1] : 0)
    .attr("r", 2.5)
    

    .attr("class", "mounds")
    .attr("d", path.pointRadius(4))
    .attr("id", d => `mound-${moundSiteKey(d.properties)}`) 
    .on("click", function (event, d) {
      event.stopPropagation();
      updateUI(d.properties, this);
    });

  
  const bbox = paramMoundG.node().getBBox();
  const paddingX = 500;
  const paddingY = 500;

  zoom.translateExtent([
    [bbox.x - paddingX, bbox.y - paddingY],
    [bbox.x + bbox.width + paddingX, bbox.y + bbox.height + paddingY]
  ]);
}


function renderVegetationLayer(vegData) {
  const meshName = Object.keys(vegData.objects)[0]; 
  const topoObject = vegData.objects[meshName];
  let vegFeatures = topojson.feature(vegData, topoObject).features;

  const realVegetation = vegFeatures.filter(d => {   
    const area = d.properties.Shape_Area;
    return d.properties.CONSD_POLY;
  });

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
    .style("opacity", 0)
    .style("pointer-events", "none");

  console.log("Drawing " + realVegetation.length + " real forest patches.");

  return { vegTypes, vegColorScale };
}


function renderCatchmentLayer(catchmentAreasData) {
  const catchmentColorScale = d3.scaleOrdinal()
    .domain(CONFIG.catchment.times)
    .range(CONFIG.catchment.colorRange);

  chanCatchG.selectAll(".catchment-feature")
    .data(catchmentAreasData.features)
    .enter()
    .append("path")
    .attr("class", "catchment-feature")
    .attr("d", path)
    .style("fill", "none")
    .style("stroke", d => {
      const val = +d.properties.level;                
      const color = catchmentColorScale(val);
      return color ? d3.color(color).darker(1) : "#999";
    })
    .style("stroke-width", 1.5)
    .style("opacity", 0)
    .style("pointer-events", "none");

  return { catchmentColorScale };
}


function renderClanTerritoriesLayer(clanTerritoriesData) {
  const clanObjects = Object.keys(clanTerritoriesData.objects)[0];
  const clanFeatures = topojson.feature(clanTerritoriesData, clanTerritoriesData.objects[clanObjects]);

  const clanColorScale = d3.scaleOrdinal(d3.schemeTableau10); 

  chanClanG.selectAll(".clan-feature")  
    .data(clanFeatures.features)
    .enter()
    .append("path")
    .attr("class", "clan-feature")
    .attr("d", path)

    
    .style("fill", d => clanColorScale(d.properties.Clan || "Unknown"))

  
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
    .style("opacity", 0)
    .style("pointer-events", "none"); 

  const uniqueClans = [...new Set(clanFeatures.features.map(d => d.properties.Clan || "Unknown"))];

  return { uniqueClans, clanColorScale };
}


function setupAggregationLayers(subbasinData, watershedData, subWatershedData) {
  return {
    huc8: { data: subbasinData, labelField: "HUC8_NAME", opacity: 0.6 },
    huc10: { data: watershedData, labelField: "WSHED_NAME", opacity: 0.6 },
    huc12: { data: subWatershedData, labelField: "HUC12_NAME", opacity: 0.6 }
  };
}


function renderAggregationLayer(key) {
  if (!paramCheckbox.checked || !key || !aggregationLayers[key]) {
    subBasinG.selectAll(".subbasin").remove();
    return;
  }
  const layer = aggregationLayers[key];
  if (!layer) return;

  const features = layer.data.features;

  const sel = subBasinG.selectAll(".subbasin")
    .data(features, d => d.properties[layer.labelField]);

  sel.enter()
    .append("path")
    .attr("class", "subbasin")
    .attr("d", path)
    .style("fill", "#3498db")
    .style("stroke", "#1f2d3a")
    .style("stroke-width", 0.5)
    .style("opacity", 0.3)
    .style("cursor", "pointer")
    .on("click", function (event, d) {
      if (!paramCheckbox.checked) return;
      showPopup2(event, d.properties, layer.labelField);
    })
    .on("mouseover", function (event) {
      if (!paramCheckbox.checked) return;
      d3.select(this)
        .transition()
        .duration(120)
        .style("opacity", 0.6)
        .style("stroke", "#f1c40f")
        .style("stroke-width", 1.5);
    })
    .on("mouseout", function () {
      if (!paramCheckbox.checked) return;
      d3.select(this)
        .transition()
        .duration(120)
        .style("opacity", 0.6)
        .style("stroke", "#1f2d3a")
        .style("stroke-width", 0.5);
    });

  sel.attr("d", path);
  sel.exit().remove();
}


function updateAggregationVisibility(key) {
  const layer = aggregationLayers[key];

  if (!paramCheckbox.checked || !layer) {
    subBasinG.selectAll(".subbasin")
      .transition()
      .duration(200)
      .style("opacity", 0)
      .remove();
    return;
  }

  subBasinG.selectAll(".subbasin")
    .style("pointer-events", "auto")
    .transition()
    .duration(300)
    .style("opacity", layer.opacity);
}


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


function showPopup2(event, props, labelField) {
  const popup = document.getElementById("popup");
  const title = document.getElementById("popup-title");
  const container = d3.select("#popup-chart");
  const popupTooltip = d3.select("#pie-tooltip");

  popup.classList.remove("hidden");
  popup.style.left = (event.pageX + 15) + "px";
  popup.style.top = (event.pageY + 15) + "px";
  title.textContent = props[labelField] || "Unknown Area";

  container.selectAll("*").remove();

  const data = CONFIG.effigySpecies
    .map(k => ({ key: k, value: +props[k] || 0 }))
    .filter(d => d.value > 0);

  const pieWidth = 240;
  const pieHeight = 240;
  const radius = Math.min(pieWidth, pieHeight) / 2;

  const svg = container.append("svg")
    .attr("width", pieWidth)
    .attr("height", pieHeight)
    .append("g")
    .attr("transform", `translate(${pieWidth / 2},${pieHeight / 2})`);

  const color = speciesColor;
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
    .on("mouseover", function (event, d) {
      d3.select(this)
        .style("opacity", 0.7)
        .style("stroke-width", "2px");
      popupTooltip
        .classed("hidden", false)
        .text(`${d.data.key}: ${d.data.value}`);
    })
    .on("mousemove", function (event) {
      popupTooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", function () {
      d3.select(this)
        .style("opacity", 1)
        .style("stroke-width", "1px");
      popupTooltip.classed("hidden", true);
    });
}


function showPopup(event, props) {
  const popup = document.getElementById("popup");
  const title = document.getElementById("popup-title");
  const container = d3.select("#popup-chart");
  const popupTooltip = d3.select("#pie-tooltip");

  popup.classList.remove("hidden");
  popup.style.left = (event.pageX + 15) + "px";
  popup.style.top = (event.pageY + 15) + "px";
  title.textContent = props.HUC8_NAME;

  container.selectAll("*").remove();

  const data = CONFIG.effigySpecies
    .map(k => ({ key: k, value: +props[k] || 0 }))
    .filter(d => d.value > 0);

  const pieWidth = 240;
  const pieHeight = 240;
  const radius = Math.min(pieWidth, pieHeight) / 2;

  const svg = container.append("svg")
    .attr("width", pieWidth)
    .attr("height", pieHeight)
    .append("g")
    .attr("transform", `translate(${pieWidth / 2},${pieHeight / 2})`);

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
    .on("mouseover", function (event, d) {
      d3.select(this)
        .style("opacity", 0.7)
        .style("stroke-width", "2px");
      popupTooltip
        .classed("hidden", false)
        .text(`${d.data.key}: ${d.data.value}`);
    })
    .on("mousemove", function (event) {
      popupTooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    })
    .on("mouseout", function () {
      d3.select(this)
        .style("opacity", 1)
        .style("stroke-width", "1px");
      popupTooltip.classed("hidden", true);
    });
}


function updateUI(p, element) {
  let animalListHtml = "";
  CONFIG.effigySpecies.forEach(key => {
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
  d3.selectAll(".mounds").style("opacity", 0.4).style("stroke", "white").style("stroke-width", "0.2px"); 
  d3.select(element).style("opacity", 1).style("stroke", "#f1c40f").style("stroke-width", "0.5px").raise();
}


function resetUI() {
  d3.select("#detail-content").html("<p class='hint'>Select a mound on the map to view archaeological data and effigy counts.</p>");
  d3.selectAll(".mounds")
    .style("opacity", 1)
    .style("stroke", null)
    .style("stroke-width", null);
}


function moundSiteKey(props) {
  return String(props["Site Name"] || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


function findMoundsBySiteName(query) {
  if (!loadedMoundData || !query) return [];

  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return loadedMoundData.features.filter(d => {
    const name = String(d.properties["Site Name"] || "").toLowerCase();
    return name.includes(needle);
  });
}

// ==========================================
// 4. UI/WIDGETS
// ==========================================


function wireSplashScreen() {
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      splash.classList.add("splash-hidden");
      setTimeout(() => {              
        splash.style.display = "none";
      }, 500);
    });
  }

  if (openBtn) {
    openBtn.addEventListener("click", function () {
      splash.style.display = "flex";
      setTimeout(() => {
        splash.classList.remove("splash-hidden");
      }, 10);
    });
  }
}


function buildVegetationLegend(vegTypes, vegColorScale) {
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
}


function wireVegetationToggles() {
  d3.selectAll(".veg-toggle").on("change", function () {
    const selectedType = this.value;
    const isChecked = this.checked;
    const masterChecked = document.getElementById("layer-nick-veg").checked;

    nickVegG.selectAll(".veg-poly")
      .filter(d => d.properties.CONSD_POLY === selectedType)
      .transition()
      .duration(200)
      .style("opacity", (isChecked && masterChecked) ? 0.7 : 0);
  });
}


function wireVegetationLayerCheckbox() {
  const nickVegCheckbox = document.getElementById("layer-nick-veg");
  const vegLegendContainer = document.getElementById("veg-legend");

  nickVegCheckbox.addEventListener("change", function () {
    const isActive = this.checked;
    vegLegendContainer.classList.toggle("hidden", !isActive);

    nickVegG.selectAll(".veg-poly")
      .transition()
      .duration(300)
      .style("opacity", d => {
        const cb = document.querySelector(`.veg-toggle[value="${d.properties.CONSD_POLY}"]`);
        return (isActive && cb && cb.checked) ? 0.7 : 0;
      })
      .style("pointer-events", isActive ? "auto" : "none");
  });
}


function buildCatchmentLegend(catchmentColorScale) {
  const catchLegendItems = d3.select("#catchment-legend-items");
  catchLegendItems.selectAll(".legend-item")
    .data(CONFIG.catchment.times)
    .enter()
    .append("div")
    .attr("class", "legend-item")
    .html(d => `
        <div class="legend-content">
            <div class="legend-color" style="background-color: ${catchmentColorScale(d)}"></div>
            <span>${CONFIG.catchment.labels[d]}</span>
        </div>
    `);
}


function wireCatchmentToggles() {
  d3.selectAll(".catchment-toggle").on("change", function () {
    const val = +this.value;          
    const isChecked = this.checked;

    chanCatchG.selectAll(".catchment-feature")
      .filter(d => d.properties.level === val)
      .transition()
      .duration(200)
      .style("opacity", isChecked ? 0.5 : 0);
  });
}


function wireCatchmentLayerCheckbox() {
  const chanCatchCheckbox = document.getElementById("layer-chan-catchment");
  const catchLegendContainer = document.getElementById("catchment-legend");

  chanCatchCheckbox.addEventListener("change", function () {
    if (this.checked) {
      catchLegendContainer.classList.remove("hidden");

      chanCatchG.selectAll(".catchment-feature")  
        .transition()
        .duration(300)
        .style("opacity", 0.5)
        .style("pointer-events", function () {
          return this.checked ? "auto" : "none";
        });
    } else {
      chanCatchG.selectAll(".catchment-feature")  
        .transition()
        .duration(200)
        .style("opacity", 0)
        .style("pointer-events", function () {
          return this.checked ? "auto" : "none";
        });

      catchLegendContainer.classList.add("hidden");
    }
  });
}


function buildClanLegend(uniqueClans, clanColorScale) {
  const clanLegendItemsContainer = d3.select("#legend-items");
  clanLegendItemsContainer.selectAll(".legend-item")
    .data(uniqueClans)
    .enter()
    .append("div")
    .attr("class", "legend-item")
    .html(d => `
        <div class="legend-content">
            <div class="legend-color" style="background-color: ${clanColorScale(d)}"></div>
            <span>${d.replace(/_/g, ' ')}</span>
        </div>
        <input type="checkbox" class="checkbox-style" value="${d}" checked>
    `);
}


function wireClanToggles() {
  d3.selectAll(".checkbox-style").on("change", function () {
    const selectedClan = this.value;
    const isChecked = this.checked;

    chanClanG.selectAll(".clan-feature")   
      .filter(d => (d.properties.Clan || "Unknown") === selectedClan)
      .transition()
      .duration(200)
      .style("opacity", isChecked ? 0.6 : 0);
  });
}


function wireClanLayerCheckbox() {
  const chanClanCheckbox = document.getElementById("layer-chan-clan");
  const clanLegendContainer = document.getElementById("clan-legend");

  chanClanCheckbox.addEventListener("change", function () {
    if (this.checked) {
      clanLegendContainer.classList.remove("hidden");     

      chanClanG.selectAll(".clan-feature")                
        .transition()
        .duration(300)
        .style("opacity", function (d) {
          const clanName = d.properties.Clan || "Unknown";
          const checkbox = document.querySelector(`.checkbox-style[value="${clanName}"]`);
          return (checkbox && checkbox.checked) ? 0.6 : 0;
        }).style("pointer-events", function () {
          return this.checked ? "auto" : "none";
        });
    } else {
      chanClanG.selectAll(".clan-feature")                
        .transition()
        .duration(200)
        .style("opacity", 0.0)
        .style("pointer-events", function () {
          return this.checked ? "auto" : "none";
        });

      clanLegendContainer.classList.add("hidden");        
    }
  });
}


function wireAggregationControls() {
  paramCheckbox.addEventListener("change", function () {
    paramGroup.classList.toggle("active", this.checked);
    paramSelect.style.display = this.checked ? "block" : "none";

    if (!this.checked) {
      paramSelect.value = "";
      activeAggregation = null;

      subBasinG.selectAll(".subbasin")
        .transition()
        .duration(200)
        .style("opacity", 0)
        .remove();

      return;
    }

    if (!paramSelect.value) return;   

    activeAggregation = paramSelect.value;
    renderAggregationLayer(activeAggregation);
    updateAggregationVisibility(activeAggregation);
  });

  paramSelect.addEventListener("change", function () {
    activeAggregation = this.value || null;

    if (!paramCheckbox.checked || !activeAggregation) {
      subBasinG.selectAll(".subbasin")
        .transition()
        .duration(200)
        .style("opacity", 0)
        .remove();
      return;
    }

    renderAggregationLayer(activeAggregation);
    updateAggregationVisibility(activeAggregation);
  });
}


function wireZoomControls() {
  d3.select("#zoom-in").on("click", function () {
    map.transition().duration(300).call(zoom.scaleBy, 1.5);
  });

  d3.select("#zoom-out").on("click", function () {
    map.transition().duration(300).call(zoom.scaleBy, 0.667);
  });
}


function wireNoteMode() {
  noteBtn.addEventListener("click", function () {
    isNoteMode = !isNoteMode;
    if (isNoteMode) {
      this.classList.add("active");
      this.textContent = "Cancel Note";
      mapContainerEl.classList.add("map-note-mode");
    } else {
      this.classList.remove("active");
      this.textContent = "📝 Add";
      mapContainerEl.classList.remove("map-note-mode");
    }
  });

  function closeAndResetNoteMode() {
    noteModal.style.display = "none";
    isNoteMode = false;
    noteBtn.classList.remove("active");
    noteBtn.textContent = "📝 Add";
    mapContainerEl.classList.remove("map-note-mode");
  }

  map.on("click", function (event) {
    if (!isNoteMode) {
      resetUI();
      return;
    }

   
    const transform = d3.zoomTransform(map.node());
    const [groupX, groupY] = transform.invert(d3.pointer(event, map.node()));
    const currentScale = transform.k;
    const currentRadius = Math.max(2, 5 / currentScale);

    
    noteModal.style.display = "flex";
    noteInput.value = "";
    noteInput.focus();

    
    submitNoteBtn.onclick = function () {
      const noteText = noteInput.value.trim();

      if (!noteText) {
        closeAndResetNoteMode();
        return;
      }

      noteModal.style.display = "none"; 

      const noteId = Date.now();        

      notesG.append("circle")           
        .attr("id", "marker-" + noteId)
        .attr("class", "note-marker")
        .attr("cx", groupX)
        .attr("cy", groupY)
        .attr("r", currentRadius)
        .on("mouseover", function (e) {
          d3.select(this).classed("highlighted", true);
          const sidebarItem = document.getElementById("item-" + noteId);
          if (sidebarItem) sidebarItem.classList.add("highlighted");

          tooltip.classed("hidden", false).text(noteText)
            .style("left", (e.pageX + 15) + "px")
            .style("top", (e.pageY + 15) + "px");
        })
        .on("mousemove", function (e) {
          tooltip.style("left", (e.pageX + 15) + "px")
            .style("top", (e.pageY + 15) + "px");
        })
        .on("mouseout", function () {
          d3.select(this).classed("highlighted", false);
          const sidebarItem = document.getElementById("item-" + noteId);
          if (sidebarItem) sidebarItem.classList.remove("highlighted");
          tooltip.classed("hidden", true);
        });

      const list = document.getElementById("notes-list");   
      if (list.classList.contains("hint")) {
        list.innerHTML = "";
        list.classList.remove("hint");
      }

      const item = document.createElement("div");
      item.className = "sidebar-note-item";
      item.id = "item-" + noteId;

      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "flex-start";
      item.style.transition = "all 0.2s";

      item.innerHTML = `
        <span style="flex: 1; min-width: 0; overflow-wrap: break-word; padding-right: 10px;">${noteText}</span>
        <button class="delete-note-btn" title="Delete Note">✖</button>
      `;

      item.addEventListener("mouseenter", function () {  
        this.classList.add("highlighted");
        d3.select("#marker-" + noteId).classed("highlighted", true);
      });
      item.addEventListener("mouseleave", function () {
        this.classList.remove("highlighted");
        d3.select("#marker-" + noteId).classed("highlighted", false);
      });

      item.querySelector(".delete-note-btn").addEventListener("click", function () { 
        item.remove();
        d3.select("#marker-" + noteId).remove();
        if (list.children.length === 0) {
          list.classList.add("hint");
          list.innerHTML = "No notes added yet.";
        }
      });

      list.appendChild(item);
      closeAndResetNoteMode();
    };


    cancelNoteBtn.onclick = function () {
      closeAndResetNoteMode();
    };


    noteInput.onkeydown = function (e) {
      if (e.key === "Enter") submitNoteBtn.click();
      if (e.key === "Escape") cancelNoteBtn.click();
    };
  });
}


function wirePopupCloseButton() {
  document.getElementById("popup-close").addEventListener("click", function () {
    document.getElementById("popup").classList.add("hidden");
  });
}


function updateStatCount(count) {
  d3.select("#stat-count").text(count);
}


function jumpToMoundSite(feature) {
  const el = document.getElementById(`mound-${moundSiteKey(feature.properties)}`);
  if (!el || !feature.geometry) return;

  const [x, y] = projection(feature.geometry.coordinates);
  const targetScale = 4;                 
  const targetTransform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(targetScale)
    .translate(-x, -y);

  map.transition()
    .duration(500)
    .call(zoom.transform, targetTransform)
    .on("end", () => updateUI(feature.properties, el));
}


function clearSiteSearchResults() {
  if (siteSearchResults) siteSearchResults.innerHTML = "";
}


function renderSiteSearchResults(matches) {
  if (!siteSearchResults) return;

  if (matches.length === 0) {
    siteSearchResults.innerHTML = '<p class="hint">No sites match that name.</p>';
    return;
  }

  siteSearchResults.innerHTML = "";
  matches.slice(0, 8).forEach((feature) => {          
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.textContent = feature.properties["Site Name"] || "Unnamed site";
    item.addEventListener("click", () => {
      jumpToMoundSite(feature);
      clearSiteSearchResults();
      siteSearchInput.value = feature.properties["Site Name"] || "";
    });
    siteSearchResults.appendChild(item);
  });
}


function wireSiteSearch() {
  if (!siteSearchInput) return;       

  siteSearchInput.addEventListener("input", function () {
    const query = this.value;

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      if (!query.trim()) {
        clearSiteSearchResults();
        return;
      }
      const matches = findMoundsBySiteName(query);
      renderSiteSearchResults(matches);
    }, CONFIG.search.debounceMs);
  });


  siteSearchInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    const matches = findMoundsBySiteName(this.value);
    if (matches.length > 0) {
      jumpToMoundSite(matches[0]);
      clearSiteSearchResults();
    }
  });
}

// ==========================================
// 5. HANDLING ERRORS
// ==========================================


function reportError(context, error) {
  console.error(`${context} failed:`, error);
  const detail = document.getElementById("detail-content");
  if (detail) {
    detail.innerHTML = `<p class="hint">${context} failed to load. Please refresh the page.</p>`;
  }
}

// ==========================================
// 6. SCRIPT EXECUTION
// ==========================================


wireSplashScreen();
wireZoomControls();
wireNoteMode();
wirePopupCloseButton();
wireAggregationControls();
wireVegetationLayerCheckbox();
wireCatchmentLayerCheckbox();
wireClanLayerCheckbox();
wireSiteSearch();

loadAllData()
  .then(function (data) {
    const moundData = data[0];
    const topoData = data[1];
    const subbasinData = data[2];
    const watershedData = data[3];
    const subWatershedData = data[4];
    const clanTerritoriesData = data[5];
    const catchmentAreasData = data[6];
    const vegData = data[7];
    const otherStatesData = data[8];

    loadedMoundData = moundData;      

    renderWisconsinBoundary(topoData);
    renderOtherStatesLayer(otherStatesData);
    renderMoundSitesLayer(moundData);

    // ==========================================
    // TEAM DATA IMPLEMENTATION START
    // ==========================================

    // [NICK'S CODE - Vegetation]
    const { vegTypes, vegColorScale } = renderVegetationLayer(vegData);
    buildVegetationLegend(vegTypes, vegColorScale);
    wireVegetationToggles();

    // [CHANODOM'S CODE - Catchments/Clan Affiliation]
    const { catchmentColorScale } = renderCatchmentLayer(catchmentAreasData);
    buildCatchmentLegend(catchmentColorScale);
    wireCatchmentToggles();

    const { uniqueClans, clanColorScale } = renderClanTerritoriesLayer(clanTerritoriesData);
    buildClanLegend(uniqueClans, clanColorScale);
    wireClanToggles();

    // [PARAM'S CODE - Proportions Aggregation]
    aggregationLayers = setupAggregationLayers(subbasinData, watershedData, subWatershedData);
    activeAggregation = paramSelect.value || null;

    if (paramCheckbox.checked && activeAggregation) {
      renderAggregationLayer(activeAggregation);
      updateAggregationVisibility(activeAggregation);
    }

    // ==========================================

    updateStatCount(moundData.features.length);
  })
  .catch(function (error) {
    reportError("Loading map data", error);
  });

};
