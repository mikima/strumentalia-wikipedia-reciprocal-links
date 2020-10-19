// check if a page contains a specific wikilink
// https://en.wikipedia.org/w/api.php?action=query&titles=wreck-it%20Ralph&prop=links&format=json&pllimit=500&redirects=

// check if there are redirects

// get first 500 links
// https://en.wikipedia.org/w/api.php?action=query&titles=wreck-it%20Ralph&prop=links&format=json&pllimit=500&redirects=

// iterate and reach the latest page

// get the whole page
// https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&page=Global%20warming&format=json&redirects=

let level = 0;
let nodes = [];
let edges = [];
let toBechecked = [];

window.onload = function () {
  $("input#submit").click(function () {
    let strings = $("textarea#inputlist").val().split("\n");
    //send to server and process response
    const queue = [];

    strings.forEach((line, i) => {
      const page = checkURL(line);
      if (page.error) {
        console.log("error:" + page.text);
      } else {
        queue.push(getLinks(page, 0));
      }
    });

    //now call all the json
    // https://stackoverflow.com/questions/25842822/request-multiple-url-using-ajax/25843396
    parseQueue(queue);
  });
};

function parseQueue(_queue) {
  // check when alla the calls are done
  $.when(..._queue).done(function () {
    // get the result of each call
    for (var i = 0; i < arguments.length; i++) {
      let item = arguments[i];
      let itemName = item[0].parse.title;
      console.log(item);
      // extract links from wikitext
      let wikilinks = extractLinks(
        item[0].parse.wikitext["*"],
        item[0].language
      );
      console.log("got", wikilinks.length, "links for", itemName);
      console.log(wikilinks);
      // check if collected pages links back.
      // populate the array of calls
      let wikilinksCall = [];
      wikilinks.forEach((d) => {
        wikilinksCall.push(getLinks(d, item[0].depth));
      });

      $.when(...wikilinksCall).done(function () {
        console.log("all links for", itemName, "loaded, filtering");
        console.log(arguments);
        // for each linked page, extract wikilinks and check if it links back
        for (var k = 0; k < arguments.length; k++) {
          let item2 = arguments[k];

          if (!item2[0].error) {
            let wikilinks2 = extractLinks(
              item2[0].parse.wikitext["*"],
              item2[0].language
            );
            const linkbackcheck = wikilinks2.filter((d) => d.page == itemName);
            if (linkbackcheck.length > 1) {
              console.log(
                "ok-",
                item2[0].parse.title,
                "links back to",
                itemName
              );
            } else {
              console.log(
                "xxx ",
                item2[0].parse.title,
                "links back to",
                itemName
              );
            }
          } else {
            console.log("error parsing links");
          }
        }
      });
      // execute them. if they links back, add to the dataset
    }
  });
}

function checkURL(_url) {
  const check = _url.match(/https?:\/\/(.+).wikipedia.org\/wiki\/([^#]+)#?.*/);
  if (check === null) {
    return { text: _url, error: true };
  } else {
    return { text: _url, page: check[2], language: check[1] };
  }
}

// get the wikilinks in a given page
function getLinks(_page, _depth) {
  const APIUrl =
    "https://" +
    _page.language +
    ".wikipedia.org/w/api.php?action=parse&prop=wikitext&page=" +
    _page.page +
    "&format=json&redirects=&origin=*";

  return $.getJSON(APIUrl, function (json_data) {
    // add to the result the original language
    // console.log("   retrieved", this.url);
    json_data.language = this.url.match(/https:\/\/([^.]+?).wikipedia/)[1];
    json_data.depth = _depth + 1;
  });
}

// extract links from wikitext
function extractLinks(_wikitext, _language) {
  // const links = _wikitext.matchAll(/\[\[([^|]+?)\]\]/g);
  const matches = _wikitext.matchAll(/\[\[([^|\[\]]+)\|?[^|\[\]]*?\]\]/g);

  const results = [...matches].map((d) => d[1].split("#")[0]); //get match, remove link to section

  const uniqueResults = [...new Set(results)]; // remove duplicate

  return uniqueResults.map((d) => ({
    language: _language,
    page: d,
  }));
}
