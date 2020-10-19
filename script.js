// list of pages to be checked
let queue = [];
// list of pages done
let done = new Set();
// list of nodes and edges
let nodes = [];
let edges = [];
// maximum depth
let maxDepth = 1;
let stoplist = new Set(["Italy"]);
let maxBacklins = 5000 / 500;

window.onload = function () {
  $("input#submit").click(async function () {
    let strings = $("textarea#inputlist").val().split("\n");
    //send to server and process response
    strings.forEach((line) => {
      let input = checkURL(line);
      if (!input.error) {
        queue.push(input);
        nodes.push(input);
      }
    });

    while (queue.length > 0) {
      let item = queue.shift();
      let source = nodes.filter((n) => n.title == item.title)[0];
      console.log(
        "checking",
        item.title,
        "depth:",
        item.depth,
        "already done:",
        done.has(item.title)
      );
      // check if the item has been already loaded
      // check if depth is not higher than the thresold
      if (
        item.depth <= maxDepth &&
        !done.has(item.title) &&
        !stoplist.has(item.title)
      ) {
        //get the common links
        let commonLinks = await getCommonLinks(item.title, item.language);
        console.log(item.title, "has", commonLinks.length, "reciprocal links");

        // prepare them as nodes
        commonLinks = commonLinks.map((d) => ({
          title: d,
          depth: item.depth + 1,
          language: item.language,
        }));
        // add nodes and links
        commonLinks.forEach((commonLink) => {
          // check if it's already present in the nodes array
          const isNewNode =
            nodes.filter((node) => node.title == commonLink.title).length == 0;
          // if it's new:
          if (isNewNode) {
            // add the node
            nodes.push(commonLink);
            // create the edge
            const newEdge = { source: source, target: commonLink, width: 1 };
            // add to the list of edges
            edges.push(newEdge);
          } else {
            // if not new, add only the link
            console.log(commonLink.title, "already present, adding link to");
            // get the node from the list
            const target = nodes.filter((n) => n.title == commonLink.title)[0];
            // create the edge
            const newEdge = { source: source, target: target, width: 1 };
            // add to the list of edges
            edges.push(newEdge);
          }
          // now that links and nodes has been added, add the commonlink to the queue
          queue.push(commonLink);
          console.log("added", commonLink.title, "to queue");
        });
      } else {
        console.log(item.title, "skipped");
      }
      //add the item to the done array
      done.add(item.title);
      console.log("network:", nodes, edges);
      console.log(queue.length, "items in queue");
    }
    // the queue is over, export results
    let edgesCSV = edges.map((d) => ({
      Source: d.source.title,
      Target: d.target.title,
      Weight: d.weight,
    }));

    console.log(edges);

    downloadCSV(edgesCSV, "edges");

    //create the sigma file
    g = {
      nodes: [],
      edges: [],
    };
    g.nodes = nodes.map((d) => ({
      id: d.title,
      label: d.title,
      data: { distance: d.depth, language: d.language },
    }));
    g.edges = edges.map((e) => ({
      source: e.source.title,
      target: e.target.title,
      weight: e.weight,
    }));
  });
};

// check if the inserted urls are valid wikipedia urls
function checkURL(_url) {
  const check = _url.match(/https?:\/\/(.+).wikipedia.org\/wiki\/([^#]+)#?.*/);
  if (check === null) {
    return { text: _url, error: true };
  } else {
    return {
      title: decodeURIComponent(check[2]),
      language: check[1],
      depth: 0,
    };
  }
}

// second try using async/await
// https://javascript.info/async-await

async function getCommonLinks(_pagename, _language) {
  // get all the outlinks
  let links = await getLinksFromWikiText(_pagename, _language);
  let backlinks = await getBackLinks(_pagename, _language);

  let common = links.filter((value) => backlinks.includes(value));
  return common;
}

async function getLinks(_title, _language) {
  const APIUrl =
    "https://" +
    _language +
    ".wikipedia.org/w/api.php?action=parse&prop=links&page=" +
    encodeURIComponent(_title) +
    "&format=json&redirects=&origin=*";

  let response = await fetch(APIUrl);
  let data = await response.json();
  // keep only the link title
  let links = data.parse.links.filter((d) => d.ns == 0).map((d) => d["*"]);

  return links;
}

async function getLinksFromWikiText(_title, _language) {
  const APIUrl =
    "https://" +
    _language +
    ".wikipedia.org/w/api.php?action=parse&prop=wikitext&page=" +
    encodeURIComponent(_title) +
    "&format=json&redirects=&origin=*";

  let response = await fetch(APIUrl);
  let data = await response.json();

  const matches = data.parse.wikitext["*"].matchAll(
    /\[\[([^|\[\]]+)\|?[^|\[\]]*?\]\]/g
  );
  const results = [...matches].map((d) => d[1].split("#")[0]); //get match, remove link to section
  const uniqueResults = [...new Set(results)]; // remove duplicate
  return uniqueResults;
}

async function getBackLinks(_title, _language) {
  // https://www.mediawiki.org/wiki/API:Backlinks
  const APIUrl =
    "https://" +
    _language +
    ".wikipedia.org/w/api.php?action=query&format=json&list=backlinks&bltitle=" +
    encodeURIComponent(_title) +
    "&bllimit=500&blnamespace=0&origin=*";

  let response = await fetch(APIUrl);
  let data = await response.json();

  let backlinks = data.query.backlinks;

  // if there are other pages, stat to loop
  let nextPage = true;
  let pageno = 1;

  while (nextPage && pageno < maxBacklins) {
    if (data.continue) {
      console.log("loading page", pageno, "for", _title);
      // create new url and load it
      const continueURL = APIUrl + "&blcontinue=" + data.continue.blcontinue;
      response = await fetch(continueURL);
      data = await response.json();
      backlinks = backlinks.concat(data.query.backlinks);
      console.log("loaded", data.query.backlinks.length, "new links");
      pageno++;
    } else {
      console.log("no more page for", _title);
      nextPage = false;
    }
  }
  return backlinks.map((d) => d["title"]);
}

// from https://stackoverflow.com/questions/52240221/download-save-csv-file-papaparse

function downloadCSV(_array, _name) {
  var csv = Papa.unparse(_array);

  var csvData = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var csvURL = null;
  if (navigator.msSaveBlob) {
    csvURL = navigator.msSaveBlob(csvData, "download.csv");
  } else {
    csvURL = window.URL.createObjectURL(csvData);
  }

  var tempLink = document.createElement("a");
  tempLink.href = csvURL;
  tempLink.setAttribute("download", _name + ".csv");
  tempLink.click();
}