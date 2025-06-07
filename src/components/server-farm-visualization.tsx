"use client";

import { useState, useEffect, JSX } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Database, HardDrive, Zap, ShieldCheck, PowerOff } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

const MAX_SCORE_FOR_LEVEL_UP = 500; // Score needed to reach the "next" conceptual level or max out progress bar

/**
 * Props for the ServerRack component.
 */
interface ServerRackProps {
  level: number; // Level of this specific rack (determines icon and title)
  isActive: boolean; // Whether this rack is currently active/online
}

/**
 * ServerRack component.
 * Represents a single server rack in the visualization.
 * Its appearance changes based on its level and active status.
 * @param {ServerRackProps} props - The component props.
 * @returns {JSX.Element} A server rack display.
 */
const ServerRack: React.FC<ServerRackProps> = ({ level, isActive }) => {
  let iconElement: React.ReactNode;
  let titleText: string;
  let statusText: string = "Offline";
  
  // Default classes for an offline rack
  let cardBgClass: string = "bg-red-50 dark:bg-red-900/30";
  let cardBorderClass: string = "border-red-400 dark:border-red-600";
  let titleColorClass: string = "text-red-800 dark:text-red-200";
  let statusColorClass: string = "text-red-700 dark:text-red-300";
  let dotColorClass: string = "bg-red-500";
  let iconContainerClasses: string = "text-red-500 dark:text-red-400";

  if (isActive) {
    // Classes for an active rack
    cardBgClass = "bg-green-50 dark:bg-green-900/30";
    cardBorderClass = "border-green-400 dark:border-green-600";
    titleColorClass = "text-green-800 dark:text-green-100";
    statusColorClass = "text-green-700 dark:text-green-200";
    dotColorClass = "bg-green-500";
    statusText = "Online";

    // Determine icon and title based on level for active racks
    switch (level) {
      case 1:
        iconElement = <HardDrive className="w-10 h-10 md:w-12 md:h-12" />;
        titleText = "Base Drive Unit";
        iconContainerClasses = "text-sky-500 dark:text-sky-400";
        break;
      case 2:
        iconElement = <Database className="w-10 h-10 md:w-12 md:h-12" />;
        titleText = "Data Server";
        statusText = "Online - Optimized";
        iconContainerClasses = "text-blue-500 dark:text-blue-400";
        break;
      case 3:
        iconElement = <Server className="w-10 h-10 md:w-12 md:h-12" />;
        titleText = "Processing Core";
        statusText = "Online - High Performance";
        iconContainerClasses = "text-purple-500 dark:text-purple-400";
        break;
      case 4:
        iconElement = <Zap className="w-10 h-10 md:w-12 md:h-12" />;
        titleText = "Power Plant";
        statusText = "Online - Max Power";
        iconContainerClasses = "text-yellow-500 dark:text-yellow-400";
        break;
      default: // Should not happen if levels are managed, but a fallback
        iconElement = <Server className="w-10 h-10 md:w-12 md:h-12" />;
        titleText = "Active Server";
        iconContainerClasses = "text-green-500 dark:text-green-400"; 
        break;
    }
  } else {
    // Icon and title for an offline rack
    iconElement = <PowerOff className="w-10 h-10 md:w-12 md:h-12" />;
    titleText = "Rack Offline";
  }

  return (
    <div className="flex-shrink-0 w-[170px] sm:w-[180px] md:w-[200px] p-1">
      <Card className={cn(
        `h-full flex flex-col justify-between shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1`,
        cardBgClass, cardBorderClass // Apply dynamic background and border colors
      )}>
        <CardHeader className="p-3 md:p-4 items-center text-center">
          <div className={cn(`p-2 md:p-3 rounded-full bg-background/70 mb-2 md:mb-3 inline-block`, iconContainerClasses)}>
            {iconElement}
          </div>
          <CardTitle className={cn(`text-sm md:text-base font-semibold`, titleColorClass)}>{titleText}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0 text-center">
          <div className="flex items-center justify-center">
            <span className={cn(`inline-block w-2.5 h-2.5 rounded-full mr-1.5`, dotColorClass)}></span>
            <p className={cn(`text-xs font-medium`, statusColorClass)}>{statusText}</p>
          </div>
          {isActive && <p className={cn(`text-xs font-bold mt-1`, statusColorClass)}>Level {level}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * ServerFarmVisualization component.
 * Displays a visualization of the user's "server farm", which upgrades based on their score.
 * Shows overall progress and individual server racks.
 * @returns {JSX.Element} The server farm visualization.
 */
export default function ServerFarmVisualization(): JSX.Element {
  const { currentUser } = useAuth();
  const [farmLevel, setFarmLevel] = useState(0); // Overall level of the farm
  const [progress, setProgress] = useState(0); // Progress towards next conceptual level
  const [numActiveRacks, setNumActiveRacks] = useState(0); // Number of active racks
  const [rackLevels, setRackLevels] = useState<number[]>(Array(6).fill(0)); // Levels of individual racks

  // Effect to update farm visualization based on current user's score
  useEffect(() => {
    if (currentUser) {
      const score = currentUser.score;
      // Progress bar reflects progress towards an arbitrary max score for visual feedback
      const calculatedProgress = Math.min((score / MAX_SCORE_FOR_LEVEL_UP) * 100, 100);
      setProgress(calculatedProgress);

      let newFarmLevel = 0;
      let newNumActiveRacks = 0;
      let newRackLevels = Array(6).fill(0); // Assuming 6 racks visually

      // Determine farm level, active racks, and individual rack levels based on score thresholds
      // This logic can be customized to define different upgrade paths.
      if (score >= 450) { newFarmLevel = 4; newNumActiveRacks = 6; newRackLevels = [4,4,3,3,2,2]; }
      else if (score >= 350) { newFarmLevel = 3; newNumActiveRacks = 5; newRackLevels = [3,3,2,2,1,0]; }
      else if (score >= 200) { newFarmLevel = 2; newNumActiveRacks = 4; newRackLevels = [2,2,1,1,0,0]; }
      else if (score >= 100) { newFarmLevel = 1; newNumActiveRacks = 3; newRackLevels = [1,1,1,0,0,0]; }
      else if (score >= 50) { newFarmLevel = 1; newNumActiveRacks = 2; newRackLevels = [1,1,0,0,0,0]; }
      else if (score > 0) { newFarmLevel = 1; newNumActiveRacks = 1; newRackLevels = [1,0,0,0,0,0]; }
      
      setFarmLevel(newFarmLevel);
      setNumActiveRacks(newNumActiveRacks);
      setRackLevels(newRackLevels);

    } else {
      // Reset if no user
      setFarmLevel(0); setNumActiveRacks(0); setProgress(0); setRackLevels(Array(6).fill(0));
    }
  }, [currentUser]);

  // Icons representing different farm tiers/levels
  const farmTierIcons = [
    Server,      // Level 0 (or default if no user)
    HardDrive,   // Level 1
    Database,    // Level 2
    Zap,         // Level 3
    ShieldCheck  // Level 4 (Max)
  ];
  const FarmOverallIcon = farmTierIcons[farmLevel] || Server; // Fallback to Server icon


  return (
    <Card className="w-full max-w-4xl mx-auto shadow-xl overflow-hidden">
      <CardHeader className="text-center pb-4">
        <FarmOverallIcon className={cn(
            `h-12 w-12 md:h-16 md:w-16 transition-all duration-500 ease-in-out transform ${farmLevel > 0 ? 'scale-110' : ''}`, // Slight scale animation if farm is active
            'text-accent', 
            'mx-auto',    
            'mb-3'        
        )} />
        <CardTitle className="text-2xl md:text-3xl font-headline">Your Datacenter</CardTitle>
        <CardDescription className="mt-1">
          {currentUser ? `Total Score: ${currentUser.score}` : 'Log in to see your datacenter.'}
          {farmLevel > 0 && ` - Datacenter Level: ${farmLevel}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 md:px-6 pb-6">
        {/* Progress Bar Section */}
        <div className="mb-6">
          <Label htmlFor="farm-progress" className="text-sm font-medium text-muted-foreground mb-1 block text-center">
            Datacenter Upgrade Progress (Goal: {MAX_SCORE_FOR_LEVEL_UP} pts)
          </Label>
          <Progress value={progress} id="farm-progress" className="w-full h-3 md:h-4" />
           <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round(progress)}%</p>
        </div>
        
        {/* Server Racks Display */}
        <div className="flex overflow-x-auto py-4 space-x-2 md:space-x-4 -mx-2 md:-mx-4 px-2 md:px-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-transparent hover:scrollbar-thumb-primary/60">
          {rackLevels.map((level, index) => (
            <div key={index} className="snap-center"> {/* Ensures racks snap into view on scroll */}
              <ServerRack level={level} isActive={index < numActiveRacks} />
            </div>
          ))}
        </div>

        {/* Informational Text */}
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground px-2">
            Drag or scroll horizontally to inspect all your datacenter equipment.
          </p>
          <p className="text-sm text-muted-foreground mt-2 px-2">
            Every contribution you share and every star you receive powers up your datacenter, unlocking better performing equipment and increasing the overall level! Keep it up!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
