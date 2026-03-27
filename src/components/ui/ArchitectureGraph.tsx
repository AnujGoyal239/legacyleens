// ============================================================
// LegacyLens — Interactive D3 Architecture Graph
// ============================================================

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  filePath: string;
  fileType: string;
  riskLevel: string;
  dependentsCount: number;
  dependenciesCount: number;
  linesOfCode: number;
  isEntryPoint: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface ArchitectureGraphProps {
  files: Array<{
    id: string;
    filePath: string;
    fileType: string;
    riskLevel: string;
    dependentsCount: number;
    dependenciesCount: number;
    linesOfCode?: number;
    isEntryPoint: boolean;
  }>;
  graphData: { nodes?: unknown[]; edges?: unknown[] } | null;
  onNodeClick?: (file: GraphNode) => void;
  searchQuery?: string;
  filter?: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444', // red
  high: '#f59e0b', // amber
  medium: '#22c55e', // green
  low: '#6b7280', // grey
};

const RISK_GLOW: Record<string, string> = {
  critical: 'rgba(239, 68, 68, 0.6)',
  high: 'rgba(245, 158, 11, 0.4)',
  medium: 'rgba(34, 197, 94, 0.3)',
  low: 'rgba(107, 114, 128, 0.2)',
};

function getNodeRadius(dependentsCount: number): number {
  if (dependentsCount >= 10) return 16;
  if (dependentsCount >= 5) return 12;
  if (dependentsCount >= 2) return 9;
  return 6;
}

function isFileType(filePath: string, type: 'frontend' | 'backend'): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (type === 'frontend') {
    return ['tsx', 'jsx', 'vue', 'svelte', 'css', 'scss', 'html'].includes(ext) ||
      filePath.includes('/components/') || filePath.includes('/pages/') || filePath.includes('/views/');
  }
  return ['ts', 'js', 'py', 'java', 'go', 'rs', 'rb'].includes(ext) &&
    (filePath.includes('/server/') || filePath.includes('/api/') || filePath.includes('/services/') ||
     filePath.includes('/routes/') || filePath.includes('/controllers/'));
}

export default function ArchitectureGraph({
  files,
  graphData,
  onNodeClick,
  searchQuery = '',
  filter = 'all',
}: ArchitectureGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // Build nodes and links from files + graphData
  const { nodes, links } = useMemo(() => {
    let filteredFiles = files;

    // Apply filter
    if (filter === 'critical') {
      filteredFiles = files.filter((f) => f.riskLevel === 'critical' || f.riskLevel === 'high');
    } else if (filter === 'frontend') {
      filteredFiles = files.filter((f) => isFileType(f.filePath, 'frontend'));
    } else if (filter === 'backend') {
      filteredFiles = files.filter((f) => isFileType(f.filePath, 'backend'));
    }

    // Cap at 200 files for performance
    const cappedFiles = filteredFiles
      .sort((a, b) => b.dependentsCount - a.dependentsCount)
      .slice(0, 200);

    const nodeMap = new Set(cappedFiles.map((f) => f.filePath));
    const graphNodes: GraphNode[] = cappedFiles.map((f) => ({
      id: f.filePath,
      filePath: f.filePath,
      fileType: f.fileType,
      riskLevel: f.riskLevel || 'low',
      dependentsCount: f.dependentsCount || 0,
      dependenciesCount: f.dependenciesCount || 0,
      linesOfCode: f.linesOfCode || 0,
      isEntryPoint: f.isEntryPoint,
    }));

    // Build links from graphData edges
    const graphLinks: GraphLink[] = [];
    if (graphData?.edges && Array.isArray(graphData.edges)) {
      for (const edge of graphData.edges as Array<{ source: string; target: string }>) {
        if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
          graphLinks.push({ source: edge.source, target: edge.target });
        }
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [files, graphData, filter]);

  const initGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 600;

    // Add zoom
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Add glow filter
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const merge = glowFilter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Create simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => getNodeRadius((d as GraphNode).dependentsCount) + 4));

    simulationRef.current = simulation;

    // Draw links
    const link = g.append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', 'rgba(148, 163, 184, 0.2)')
      .attr('stroke-width', 1);

    // Draw nodes
    const node = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => getNodeRadius(d.dependentsCount))
      .attr('fill', (d) => RISK_COLORS[d.riskLevel] || RISK_COLORS.low)
      .attr('stroke', (d) => {
        if (searchQuery && d.filePath.toLowerCase().includes(searchQuery.toLowerCase())) {
          return '#ffffff';
        }
        return 'rgba(255,255,255,0.1)';
      })
      .attr('stroke-width', (d) => {
        if (searchQuery && d.filePath.toLowerCase().includes(searchQuery.toLowerCase())) {
          return 3;
        }
        return 1;
      })
      .attr('filter', (d) => d.riskLevel === 'critical' ? 'url(#glow)' : '')
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        if (onNodeClick) onNodeClick(d);
      })
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Labels for important nodes
    const labels = g.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes.filter((n) => n.dependentsCount >= 3 || n.isEntryPoint))
      .enter()
      .append('text')
      .text((d) => {
        const parts = d.filePath.split('/');
        return parts[parts.length - 1] || d.filePath;
      })
      .attr('font-size', '9px')
      .attr('fill', 'rgba(226,232,240,0.8)')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => getNodeRadius(d.dependentsCount) + 14)
      .style('pointer-events', 'none');

    // Tooltip
    node.append('title').text((d) => `${d.filePath}\n${d.dependentsCount} dependents • ${d.linesOfCode} lines • ${d.riskLevel}`);

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      node
        .attr('cx', (d) => d.x || 0)
        .attr('cy', (d) => d.y || 0);

      labels
        .attr('x', (d) => d.x || 0)
        .attr('y', (d) => d.y || 0);
    });

    // Reset zoom function attached to container
    (containerRef.current as any).__resetZoom = () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    };
  }, [nodes, links, onNodeClick, searchQuery]);

  useEffect(() => {
    initGraph();
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [initGraph]);

  return (
    <div ref={containerRef} className="relative h-[600px] w-full rounded-xl border border-border bg-slate-950 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full"
        style={{ background: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)' }}
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-lg bg-slate-900/80 px-3 py-2 backdrop-blur-sm">
        {Object.entries(RISK_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-slate-400 capitalize">{level}</span>
          </div>
        ))}
      </div>
      {/* Node count */}
      <div className="absolute top-4 right-4 rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 backdrop-blur-sm">
        {nodes.length} nodes • {links.length} edges
      </div>
    </div>
  );
}
