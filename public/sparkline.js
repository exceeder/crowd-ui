//mostly based on https://github.com/Zen33/vue-sparklines (MIT Licence)
export const min = data => Math.min.apply(Math, data);
export const max = data => Math.max.apply(Math, data);
export const arrayMax = max;
export const arrayMin = min;

export const avg = data => data.reduce((a, b) => a + b) / data.length;
export const mean = avg;

export const midRange = data => max(data) - min(data) / 2;
export const median = data => data.sort((a, b) => a - b)[Math.floor(data.length / 2)];

export const stdev = data => {
    const dataMean = mean(data);
    const sqDiff = data.map(n => Math.pow(n - dataMean, 2));
    const avgSqDiff = mean(sqDiff);
    return Math.sqrt(avgSqDiff);
};

export const variance =  data => {
    const dataMean = mean(data);
    const sq = data.map(n => Math.pow(n - dataMean, 2));
    return mean(sq)
};

export const evt = (mouseEvents, data, p) => {
    const evts = {};
    if (typeof mouseEvents === 'function') {
        ['enter', 'leave', 'up', 'down', 'move', 'over'].map(evt => {
            return evts[`mouse${evt}`] = () => mouseEvents(`mouse${evt}`, data, p)
        })
    }
    return evts
};

export const dataToPoints = ({ data, limit, width = 1, height = 1, margin = 0, max = arrayMax(data), min = arrayMin(data), textHeight = 0 }) => {
    const len = data.length;
    if (limit && limit < len) {
        data = data.slice(len - limit)
    }
    const vfactor = (height - margin * 2 - textHeight) / ((max - min) || 2);
    const hfactor = (width - margin * 2) / ((limit || len) - (len > 1 ? 1 : 0));
    return data.map((d, i) => ({
        x: i * hfactor + margin,
        y: (max === min ? 1 : (max - d)) * vfactor + margin + textHeight
    }))
};

export const utils = {
    'max': max,
    'min': min,
    'mean': mean,
    'median': median,
    'avg': avg,
    'midRange': midRange,
    'variance': variance,
    'stdev': stdev,
    'evt': evt,
    'dataToPoints': dataToPoints
};

const Spot = {
    props: ['points', 'spotStyles', 'spotProps'],
    methods: {
        lastPoint (points) {
            const pl = points.length;
            Math.sign = Math.sign || (x => {
                return x > 0 ? 1 : -1
            });
            return pl < 2 ? 0 : Math.sign(points[pl - 2].y - points[pl - 1].y)
        }
    },
    render (h) {
        const { points, spotStyles, spotProps } = this;
        const pl = points.length;
        return h('g', (() => {
            const items = [];
            spotStyles && items.push(h('circle', {
                style: spotStyles,
                attrs: {
                    cx: points[0].x,
                    cy: points[0].y,
                    r: spotProps.size
                }
            }));
            items.push(h('circle', {
                style: Object.assign(spotStyles, {
                    fill: spotProps.spotColors[this.lastPoint(points)],
                    fillOpacity: 1,
                    strokeOpacity: 1
                }),
                attrs: {
                    cx: points[pl - 1].x,
                    cy: points[pl - 1].y,
                    r: spotProps.size
                }
            }));
            return items
        })())
    }
};

const Text = {
    props: ['point', 'margin', 'text', 'textStyles'],
    render (h) {
        const { point, margin, text, textStyles } = this;
        const { x, y } = point;
        return h('g', [
            h('text', {
                style: textStyles,
                attrs: {
                    x,
                    y
                },
                ref: 'sparklineText'
            }, text)
        ])
    },
    mounted () {
        const text = this.$refs.sparklineText;
        const textBox = text && text.getBBox();
        if (textBox) {
            text.setAttribute('x', textBox.x - textBox.width / 2);
            text.setAttribute('y', this.margin + textBox.height / 2)
        }
    }
};

const RefLine = {
    props: ['points', 'margin', 'refLineType', 'refLineProps', 'refLineStyles'],
    render (h) {
        const { points, margin, refLineType, refLineProps, refLineStyles } = this;
        const ypoints = points.map(p => p.y);
        const y = refLineType === 'custom' ? refLineProps.value : utils[refLineType](ypoints);
        refLineStyles['shape-rendering'] = 'crispEdges'; // removes line blur
        return h('line', {
            style: refLineStyles,
            attrs: {
                x1: points[0].x,
                y1: y + margin,
                x2: points[points.length - 1].x,
                y2: y + margin
            }
        })
    }
};

const Gradient = {
    props: ['gradient', 'id'],
    render (h) {
        const { gradient, id } = this;
        const len = gradient.length - 1 || 1;
        const stops = gradient.slice().reverse().map((c, i) => h('stop', {
            attrs: {
                offset: i / len,
                'stop-color': c
            },
            props: {
                key: i
            }
        }));
        return h('defs', [
            h('linearGradient', {
                attrs: {
                    id,
                    x1: 0,
                    y1: 0,
                    x2: 0,
                    y2: 1
                }
            }, stops)
        ])
    }
};

const Line = {
    name: 'sparkline-line',
    props: ['data', 'hasSpot', 'limit', 'max', 'min', 'spotlight', 'width', 'height', 'margin', 'styles', 'spotStyles', 'spotProps', 'dataToPoints', 'refLineType', 'refLineStyles', 'textStyles', 'bus', 'mouseEvents'],
    render (h) {
        const { data = [], hasSpot, limit, max, min, spotlight, width, height, margin, styles, spotStyles, spotProps, dataToPoints, refLineType, refLineStyles, textStyles, bus, mouseEvents } = this;
        if (!data.length) {
            return null
        }
        const hasSpotlight = typeof spotlight === 'number';
        const leeway = 10;
        const points = dataToPoints({
            data,
            limit,
            width,
            height,
            margin,
            max,
            min,
            textHeight: hasSpotlight ? leeway : 0
        });
        bus && bus.$emit('setValue', {
            id: `sparkline__${this._uid}`,
            color: styles.stroke || styles.fill || '#fff',
            data,
            points,
            limit,
            type: 'line'
        });
        const linePoints = points.map(p => [p.x, p.y]).reduce((a, b) => a.concat(b));
        const closePolyPoints = [
            points[points.length - 1].x,
            height - margin,
            margin,
            height - margin,
            margin,
            points[0].y
        ];
        const fillPoints = linePoints.concat(closePolyPoints);
        const lineStyle = {
            stroke: styles.stroke || 'slategray',
            strokeWidth: styles.strokeWidth || '1',
            strokeLinejoin: styles.strokeLinejoin || 'round',
            strokeLinecap: styles.strokeLinecap || 'round',
            fill: 'none'
        };
        const fillStyle = {
            stroke: styles.stroke || 'none',
            strokeWidth: '0',
            fillOpacity: styles.fillOpacity || '.1',
            fill: styles.fill || '#242e9d', // slategray
            pointerEvents: 'auto'
        };
        const props = this.$props;
        props.points = points;
        const checkSpotType = (items, p, i) => {
            if (!hasSpot && !hasSpotlight) {
                return true
            } else if (!hasSpot && spotlight === i) {
                props.text = data[spotlight];
                props.point = p;
                items.push(h(Text, { props }));
                return true
            }
            return false
        };
        return h('g', (() => {
            const items = [];
            items.push(h('polyline', {
                    style: fillStyle,
                    attrs: {
                        points: fillPoints.join(' ')
                    }
                }),
                h('polyline', {
                    style: lineStyle,
                    attrs: {
                        points: linePoints.join(' ')
                    }
                }));
            hasSpotlight && points.map((p, i) => {
                return checkSpotType(items, p, i) && items.push(h('circle', {
                    style: spotStyles,
                    attrs: {
                        cx: p.x,
                        cy: p.y,
                        r: spotProps.size,
                        rel: data[i]
                    },
                    props: {
                        key: i
                    },
                    on: evt(mouseEvents, data[i], p)
                }))
            });
            hasSpot && items.push(h(Spot, { props }));
            refLineStyles && items.push(h(RefLine, { props }));
            return items
        })())
    }
};

const Bar = {
    name: 'sparkline-bar',
    props: ['data', 'limit', 'max', 'min', 'width', 'height', 'margin', 'styles', 'dataToPoints', 'refLineType', 'refLineStyles', 'bus', 'mouseEvents'],
    render (h) {
        const { data = [], limit, max, min, width, height, margin, styles, dataToPoints, refLineType, refLineStyles, bus, mouseEvents } = this;
        if (!data.length) {
            return null
        }
        const points = dataToPoints({
            data,
            limit,
            width,
            height,
            margin,
            max,
            min
        });
        const barStyle = { fill: styles.fill || '#242e9d'};
        const strokeWidth = styles && styles.strokeWidth || 0;
        const marginWidth = margin ? 2 * margin : 0;
        const nonLimit = data.length === limit;
        const barWidth = styles.barWidth || nonLimit ? ((width - limit * (marginWidth + strokeWidth )) / limit)  : (points && points.length >= 2 ? Math.max(0, points[1].x - points[0].x - strokeWidth - marginWidth) : 0);
        const props = this.$props;
        let adjustPos = [];
        props.points = points;
        return h('g', {
            attrs: {
                // transform: `scale(1, -1)`
            }
        }, (() => {
            const items = [];
            points.map((p, i) => {
                return items.push(h('rect', {
                    style: barStyle,
                    attrs: {
                        // x: p.x - (barWidth + strokeWidth) / 2,
                        x: (() => {
                            adjustPos[i] = adjustPos[i] || {};
                            if (nonLimit) {
                                const curX = Math.ceil((barWidth + strokeWidth + marginWidth) * i + margin);
                                adjustPos[i].x = curX + barWidth;
                                return curX
                            } else {
                                const curX = Math.ceil(p.x - strokeWidth * i);
                                adjustPos[i].x = curX + barWidth;
                                return curX
                            }
                        })(),
                        // y: -height,
                        y: (() => {
                            return (adjustPos[i].y = Math.ceil(p.y))
                        })(),
                        width: Math.ceil(barWidth),
                        height: Math.ceil(Math.max(0, height - p.y)),
                        rel: data[i]
                    },
                    props: {
                        key: i
                    },
                    on: evt(mouseEvents, data[i], p)
                }))
            });
            bus && bus.$emit('setValue', {
                id: `sparkline__${this._uid}`,
                color: styles.stroke || styles.fill || '#fff',
                data,
                points: adjustPos,
                limit,
                type: 'bar'
            });
            refLineStyles && items.push(h(RefLine, { props }));
            return items
        })())
    }
};

const Pie = {
    name: 'sparkline-pie',
    props: ['data', 'max', 'min', 'width', 'height', 'margin', 'styles', 'tooltipProps', 'indicatorStyles'],
    data () {
        return {
            onFocus: false
        }
    },
    watch: {
        data () {
            this.onFocus && this.hideTooltip()
        }
    },
    methods: {
        hideTooltip () {
            const tooltip = this.$parent.$refs.sparklineTooltip;
            tooltip && (tooltip.style.display = 'none')
        },
        showTooltip (evt, value, color) {
            const tooltip = this.$parent.$refs.sparklineTooltip;
            tooltip && (tooltip.style.display = '');
            const leeway = tooltip.getBoundingClientRect();
            const tooltipContent = `<span style="color:${color};">&bull;</span>&nbsp;${value}<br />`;
            if (leeway) {
                tooltip.style.left = `${evt.clientX + leeway.width * .25}px`;
                tooltip.style.top = `${evt.clientY - leeway.height}px`;
                try {
                    tooltip.innerHTML = this.tooltipProps.formatter({ value, color}) || tooltipContent
                } catch (e) {
                    return (tooltip.innerHTML = tooltipContent)
                }
            }
        }
    },
    render (h) {
        const { data = [], max, min, width, height, margin, styles, tooltipProps, indicatorStyles } = this;
        if (!data.length) {
            return null
        }
        const center = Math.min(width / 2, height / 2);
        const strokeWidth = styles && styles.strokeWidth || 0;
        const radius = center - strokeWidth / 2;
        // const radius = center - margin
        let prevPieNumbers = 0;
        for (let slot of this.$parent.$slots.default) {
            (slot.tag === 'sparklinePie') && prevPieNumbers++
        }
        if (prevPieNumbers > 1) { // only one pie chart in the slot
            return null
        }
        const total = Math.ceil(data.reduce((a, b) => (b.hasOwnProperty('value') ? b.value : b) + a, 0));
        let angleStart = 0;
        let angleEnd = 0;
        // const startX = center + (prevPieNumbers > 1 ? prevPieNumbers - 1 : 0) * (radius + margin * 2)
        const startX = center;
        return h('g', {
            attrs: {
                // transform: `translate(0, 0)`
            }
        }, (() => {
            const items = [];
            if (data.length === 1) {
                items.push(h('ellipse', {
                    style: styles,
                    attrs: {
                        cx: startX,
                        cy: center,
                        rx: radius,
                        ry: radius,
                        fill: data[0].color
                    },
                    on: {
                        mousemove: evt => {
                            this.onFocus = true;
                            indicatorStyles && this.showTooltip(evt, data[0].value, data[0].color)
                        },
                        mouseleave: () => {
                            this.onFocus = false;
                            this.hideTooltip()
                        }
                    }
                }))
            } else {
                data.map((d, i) => {
                    const value = d.hasOwnProperty('value') ? d.value : d;
                    const isLarge = value / total > 0.5;
                    const angle = 360 * value / total;
                    angleStart = angleEnd;
                    angleEnd = angleStart + angle;
                    const x1 = startX + radius * Math.cos(Math.PI * angleStart / 180);
                    const y1 = center + radius * Math.sin(Math.PI * angleStart / 180);
                    const x2 = startX + radius * Math.cos(Math.PI * angleEnd / 180);
                    const y2 = center + radius * Math.sin(Math.PI * angleEnd / 180);
                    const path = `M${startX},${center} L${x1},${y1} A${radius},${radius} 0 ${isLarge ? 1 : 0},1 ${x2},${y2} Z`;
                    const color = d.hasOwnProperty('color') ? d.color : (styles && styles.fill || '#000');
                    items.push(h('path', {
                        style: styles,
                        attrs: {
                            fill: color,
                            d: path
                        },
                        props: {
                            key: i
                        },
                        on: {
                            mousemove: evt => {
                                this.onFocus = true;
                                indicatorStyles && this.showTooltip(evt, value, color)
                            },
                            mouseleave: () => {
                                this.onFocus = false;
                                this.hideTooltip()
                            }
                        }
                    }))
                })
            }
            return items
        })())
    }
};


//export default Sparkline
export default {
    name: 'sparkline',
    props: {
        spotlight: { // highlight value by index
            type: [Number, Boolean],
            default: false
        },
        limit: { // max data points in a single presentation
            type: [Number, String],
            default: 0
        },
        width: {
            type: [Number, String],
            default: 100
        },
        height: {
            type: [Number, String],
            default: 30
        },
        preserveAspectRatio: { // do we need to scale
            type: String,
            default: 'none'
        },
        margin: {
            type: Number,
            default: 2
        },
        min: {
            type: Number
        },
        max: {
            type: Number
        },
        hasSpot: { // use highlights?
            type: Boolean,
            default: false
        },
        spotProps: { // highlight properties
            type: Object,
            default: () => ({
                size: 3,
                spotColors: {
                    '-1': 'red',
                    '0': 'yellow',
                    '1': 'green'
                }
            })
        },
        spotStyles: {
            type: Object,
            default: () => ({
                strokeOpacity: 0,
                fillOpacity: 0
            })
        },
        refLineType: { // reference line: 'max', 'min', 'mean', 'avg', 'median', 'custom' or false
            type: [String, Boolean],
            default: 'mean'
        },
        refLineProps: { // reference line attribute
            type: Object,
            default: () => ({
                value: null
            })
        },
        styles: { // sparkline styles
            type: Object,
            default: () => ({})
        },
        textStyles: { // highlight text styles
            type: Object,
            default: () => ({
                fontSize: 10
            })
        },
        indicatorStyles: { // indicator style
            type: [Object, Boolean],
            default: () => ({
                stroke: 'red'
            })
        },
        tooltipProps: { // tooltip attributes
            type: Object,
            default: () => ({
                formatter () {
                    return null
                }
            })
        },
        tooltipStyles: { // tooltip样式
            type: Object,
            default: () => ({
                position: 'absolute',
                display: 'none',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '3px',
                minWidth: '30px',
                padding: '3px',
                color: '#fff',
                fontSize: '12px'
            })
        }
    },
    data () {
        return {
            datum: {},
            curEvt: {},
            onFocus: false
        }
    },
    created () {
        this.bus.$on('setValue', val => {
            const { data, points, color, limit } = val;
            this.datum[val.id] = {
                data: data.length >= limit ? data.slice(-limit) : data,
                points,
                color
            };
            Object.keys(this.curEvt).length && this.updateData()
        })
    },
    mounted () {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.$refs.sparklineTooltip);
        document.body.appendChild(fragment)
    },
    beforeDestroy () {
        const tooltip = this.$refs.sparklineTooltip;
        tooltip && tooltip.parentNode.removeChild(tooltip)
    },
    computed: {
        bus () {
            return new Vue()
        }
    },
    methods: {
        setStatus (status = true) {
            const indicator = this.$refs.sparklineIndicator;
            const tooltip = this.$refs.sparklineTooltip;
            tooltip && (tooltip.style.display = status ? '' : 'none');
            indicator && (indicator.style.display = status ? '' : 'none')
        },
        updateData() {
            if (!this.onFocus) {
                return false
            }
            let leeway;
            let curData;
            let tooltipContent = '';
            const tooltip = this.$refs.sparklineTooltip;
            for (let datum in this.datum) {
                curData = null;
                if (this.datum.hasOwnProperty(datum)) {
                    this.setStatus(false);
                    for (let [index, pos] of this.datum[datum].points.entries()) {
                        if (this.curEvt.ox < pos.x && curData === null) {
                            this.setStatus();
                            leeway = tooltip.getBoundingClientRect();
                            curData = {
                                value: this.datum[datum].data[index],
                                color: this.datum[datum].color
                            };
                            tooltipContent += `<span style="color:${curData.color};">&bull;</span>&nbsp;${curData.value}<br />`
                        }
                    }
                }
            }
            if (leeway) {
                tooltip.style.left = `${this.curEvt.cx + leeway.width * .25}px`;
                tooltip.style.top = `${this.curEvt.cy - leeway.height}px`;
                try {
                    tooltip.innerHTML = this.tooltipProps.formatter(curData) || tooltipContent
                } catch (e) {
                    return (tooltip.innerHTML = tooltipContent)
                }
            }
        }
    },
    render (h) {
        const { width, height, preserveAspectRatio, margin, max, min, hasSpot, spotProps, refLineType, refLineProps, styles, textStyles, indicatorStyles, tooltipProps } = this;
        const svgOpts = {
            viewBox: `0 0 ${width} ${height}`,
            preserveAspectRatio
        };
        styles.width = width;
        styles.height = height;
        const rootProps = this.$props;
        rootProps.dataToPoints = dataToPoints;
        indicatorStyles && (rootProps.bus = this.bus);
        const slots = this.$slots.default;
        return h('div', {
            'class': 'sparkline-wrap'
        }, [
            h('svg', {
                style: styles,
                attrs: svgOpts,
                on: {
                    mousemove: evt => {
                        if (indicatorStyles) {
                            const ox = evt.offsetX || evt.layerX;
                            const oy = evt.offsetY || evt.layerY;
                            const cx = evt.clientX;
                            const cy = evt.clientY;
                            this.curEvt = {
                                ox,
                                oy,
                                cx,
                                cy,
                                target: evt.target
                            };
                            const indicator = this.$refs.sparklineIndicator;
                            indicator.setAttribute('x1', ox);
                            indicator.setAttribute('x2', ox)
                        }
                        this.onFocus = true;
                        this.updateData()
                    },
                    mouseleave: () => {
                        this.onFocus = false;
                        this.setStatus(false)
                    }
                }
            }, (() => {
                const items = slots.map(item => {
                    const tag = item.tag;
                    const props = Object.assign({}, rootProps, item.data && item.data.attrs || {});
                    if (tag === 'sparklineLine') {
                        return h(Line, { props })
                    } else if (tag === 'sparklineBar') {
                        return h(Bar, { props })
                    } else {
                       return h(Pie, { props })
                    }
                });
                if (indicatorStyles) {
                    indicatorStyles['shape-rendering'] = 'crispEdges';
                    indicatorStyles['display'] = 'none';
                    items.push(h('line', {
                        style: indicatorStyles,
                        attrs: {
                            x1: 0,
                            y1: 0,
                            x2: 0,
                            y2: height
                        },
                        ref: 'sparklineIndicator'
                    }))
                }
                return items
            })()),
            h('div', {
                'class': 'sparkline-tooltip',
                style: this.tooltipStyles,
                ref: 'sparklineTooltip'
            })
        ])
    }
}
