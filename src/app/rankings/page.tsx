import { MainLayout } from '@/components/layout/main-layout';
import { calculateTopDevelopers } from '@/ai/flows/top-developer-ranking';
import type { TopDeveloper } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUserById } from '@/lib/placeholder-data';
import { Award, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

async function getRanks(): Promise<TopDeveloper[]> {
  try {
    // In a real app, this would read from a pre-calculated 'topDevelopers' collection in Firestore.
    // For this prototype, we call the AI flow directly to demonstrate its function.
    const developerRanks = await calculateTopDevelopers({});
    
    // Enrich with user data from placeholder data
    const enrichedRanks = developerRanks.map(dev => ({
      ...dev,
      user: getUserById(dev.developerId),
    }));

    return enrichedRanks;
  } catch (error) {
    console.error("Failed to calculate top developers:", error);
    // Return empty array or mock data on error
    return [];
  }
}

export default async function RankingsPage() {
  const rankedDevelopers = await getRanks();

  const getMedal = (index: number) => {
    if (index === 0) return <Award className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Award className="h-5 w-5 text-slate-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm font-medium w-5 text-center">{index + 1}</span>;
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Top Developers</h1>
          <p className="text-muted-foreground max-w-2xl">
            Celebrating the creators making the biggest impact on our platform. Rankings are calculated based on NFTs created, sales volume, and community engagement.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
                <TrendingUp className="mr-2 h-5 w-5"/>
                Developer Leaderboard
            </CardTitle>
            <CardDescription>Updated periodically to reflect contributions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Developer</TableHead>
                  <TableHead className="text-right">Contribution Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedDevelopers.length > 0 ? (
                    rankedDevelopers.map((dev, index) => (
                    <TableRow key={dev.developerId}>
                      <TableCell>
                        <div className="flex items-center justify-center font-bold h-10 w-10 rounded-full bg-secondary">
                          {getMedal(index)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={dev.user?.photoURL || ''} alt={dev.user?.displayName || 'User'}/>
                            <AvatarFallback>{dev.user?.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{dev.user?.displayName || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">{dev.user?.email || 'No email'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-lg font-mono bg-primary/10 text-primary">
                          {dev.contributionScore.toFixed(2)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">
                            Could not load developer rankings.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
