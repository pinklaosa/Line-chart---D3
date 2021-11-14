import * as d3 from "d3";


console.log("hola wold");
const parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");

  const loaddata = d3.csv("data/NORMAL_DATA.csv").then((d) => {
    const data = d.columns.slice(19).map((sensor) => {
      return {
        col: sensor,
        values: d.map((v) => {
          return {
            date: parseDate(v.TimeStamp),
            vSensor: +v[sensor],
          };
        }),
      };
    });
    chart(data);
  });

  const chart = (data) => {
    //Start
    const svg = d3.select("#chart");
    (margin = { top: 10, right: 30, bottom: 30, left: 60 }),
      (width = +svg.attr("width") - margin.left - margin.right),
      (height = +svg.attr("height") - margin.top - margin.bottom);

    const x = d3
      .scaleTime()
      .nice()
      .domain(d3.extent(data[0].values, (d) => d.date))
      .range([margin.left, width + 30]);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min(data, (d) => d3.min(d.values, (v) => v.vSensor)),
        d3.max(data, (d) => d3.max(d.values, (v) => v.vSensor)),
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const xAxis = svg
      .append("g")
      .attr("class", "axis--x")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    const yAxis = svg
      .append("g")
      .attr("class", "axis--y")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(-width + margin.right));

    const defs = svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("x", margin.left)
      .attr("width", width - margin.right)
      .attr("height", height);

    const curve = d3.curveLinear;
    const line = d3
      .line()
      .curve(curve)
      .x((data) => x(data.date))
      .y((data) => y(data.vSensor));

    const g = svg
      .append("g")
      .attr("class", "path")
      .attr("clip-path", "url(#clip)");

    const lines = g
      .selectAll("lines")
      .data(data)
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("class", "line")
      .attr("stroke", (d) => color(d))
      .attr("d", (data) => line(data.values));

    const extent = [
      [margin.left, margin.top],
      [width - margin.right, height - margin.top],
    ];

    const zoom = d3
      .zoom()
      .scaleExtent([1, 10])
      .translateExtent(extent)
      .extent(extent)
      .on("zoom", (event) => {
        const xz = event.transform.rescaleX(x);
        const zoomLine = line.x((data) => xz(data.date));
        svg.selectAll(".line").attr("d", (data) => zoomLine(data.values));
        svg.select(".axis--x").call(d3.axisBottom(xz));
      });

    svg.call(zoom);
  };