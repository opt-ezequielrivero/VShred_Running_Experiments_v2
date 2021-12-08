console.warn("code");
var form = document.querySelector("form");
var prompt = document.querySelector("p.prompt");
var experiments = [];
var experiments_base = [];
var experiments_results = [];
var page = 1;

function makeXHR() {
    var projectId = document.querySelector("#projectId").value;
    var apiKey = document.querySelector("#apiKey").value;
    var xhttp = new XMLHttpRequest();
    var xhr = [];

    if (page===1) {
      prompt.innerText += "Loading experiments (this may take a few seconds)..";
    } else {
      prompt.innerText += "Loading MORE experiments.."
    }

    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var parsedResp = JSON.parse(this.response);
            for (i = 0; i < parsedResp.length; i++) {
              experiments.push(parsedResp[i]);
            }
            console.warn("amount of experiments = " + experiments.length);

            if (parsedResp.length > 0) {
              console.log(`Reading from page: ${page}`);
              page ++;
              makeXHR();
            } else {
                prompt.innerText += "\n\nloading experiments results..";
                for (var i = 0; i < experiments.length; i++) {
                    if (experiments[i].status == "running") {
                        // save into array the running experiments
                        experiments_base.push({ key: experiments[i].id, base: experiments[i] });
                        // for each runningexperiment - get results
                        xhr[i] = new XMLHttpRequest();
                        xhr[i].onreadystatechange = function () {
                            if (this.readyState == 4 && this.status == 200) {
                                // get id of experiment from response URL
                                var id = parseInt(this.responseURL.substr(42, 11));
                                // experiments_base[i].push(JSON.parse(this.responseText));
                                experiments_results.push({
                                    key: id,
                                    results: JSON.parse(this.responseText),
                                });
                                if (experiments_base.length == experiments_results.length) {
                                    prompt.innerText += "experiments results complete, \n\nvoila!";
                                    showResults(experiments_base, experiments_results);
                                }
                            }
                        };
                        xhr[i].open(
                            "GET",
                            "https://api.optimizely.com/v2/experiments/" + experiments[i].id + "/results",
                            true
                        );
                        xhr[i].setRequestHeader("Authorization", "Bearer " + apiKey);
                        xhr[i].send();
                    }
                }
            }
        }
      };
    xhttp.open("GET", `https://api.optimizely.com/v2/experiments?project_id=${projectId}&per_page=25&page=${page}`, true);
    xhttp.setRequestHeader("Authorization", "Bearer " + apiKey);
    xhttp.send();
}

document.querySelector("#submit").addEventListener("click", function () {
    makeXHR();
    page ++
});

function showResults(experiments_base, experiments_results) {
    console.warn("showResults = experiments_base");
    console.warn(experiments_base);
    console.warn("showResults = experiments_results");
    console.warn(experiments_results);

    var container = document.querySelector(".results-container");

    for (var i = 0; i < experiments_base.length; i++) {
        var base = experiments_base[i].base;

        var exp = document.createElement("div");
        exp.classList.add("exp");

        exp.insertAdjacentHTML("beforeend", "<h3 class='exp-title'>" + base.name + "</h3>");
        if (base.url_targeting) {
          printValue("Targeting Component", base.url_targeting.key, exp);
          printValue("Example URL", base.url_targeting.edit_url, exp);
        } else if (base.page_ids) {
          printValue ("Targeting pages", base.page_ids, exp);
        }
        printValue("Last Modified", base.last_modified.substr(0, 10), exp);
        exp.insertAdjacentHTML("beforeend", "<h2> Variations </p>");

        var exp_results = document.createElement("div");
        exp_results.classList.add("experiment-results");

        var target_results = experiments_results.find((o) => o.key === base.id);

        var variations = target_results.results.reach.variations;
        var primary_metric_variations = target_results.results.metrics[0].results;

        // join both variations data and primary metric variations data
        var variation_array = [];
        for (var [key, value] of Object.entries(variations)) {
            for (var [key2, value2] of Object.entries(primary_metric_variations)) {
                if (value.variation_id == key2) {
                    variation_array.push([value, value2]);
                }
            }
        }

        console.warn("variation array:");
        console.warn(variation_array);

        for (var v = 0; v < variation_array.length; v++) {
            var variation = document.createElement("div");
            variation.classList.add("variation");

            var is_control = variation_array[v][1].is_baseline == true;

            variation.insertAdjacentHTML("beforeend", "<h4>" + variation_array[v][0].name + "</h4>");

            printValue("Visitors", variation_array[v][0].count, variation);
            printValue("Traffic", toPercentage(variation_array[v][0].variation_reach, 100), variation);

            if (!is_control) {
                printValue("Status", variation_array[v][1].lift.lift_status, variation);
                printValue("Is significant?", variation_array[v][1].lift.is_significant, variation);
                if (variation_array[v][1].lift.value > 0)
                    printValue("Stat Sig", toPercentage(variation_array[v][1].lift.significance, 100), variation);
            }
            if (variation_array[v][1].variance) {
                printValue("Conversions/visitor", Math.round(variation_array[v][1].variance * 1000) / 1000, variation);
                printValue("Improvement", calculateImprovement(variation_array, v), variation);
            }
            exp_results.appendChild(variation);
        }

        exp.appendChild(exp_results);
        container.appendChild(exp);
    }
}
function printValue(name, value, target) {
    target.insertAdjacentHTML(
        "beforeend",
        "<div class='item " + name + "'><strong>" + name + ":</strong> <span class='data'>" + value + "</span> </div>"
    );
}
function toPercentage(num, multiplier) {
    return Math.round((num + Number.EPSILON) * multiplier) + "%";
}

function calculateImprovement(variation_array, v) {
    var original_conversion;
    var variation_conversion = parseFloat(variation_array[v][1].variance);
    for (var i = 0; i < variation_array.length; i++) {
        if (variation_array[i][1].is_baseline == true) {
            original_conversion = parseFloat(variation_array[i][1].variance);
        }
    }
    if (original_conversion == 0) {
        return "--";
    } else {
        return Math.round(((variation_conversion - original_conversion) / original_conversion) * 1000) / 10 + "%";
    }
}
