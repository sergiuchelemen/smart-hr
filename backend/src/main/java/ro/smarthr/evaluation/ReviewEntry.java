package ro.smarthr.evaluation;

import java.time.Instant;
import java.util.Map;

public class ReviewEntry {

    private Map<String, Integer> scores;
    private String comment;
    private Instant submittedAt;

    public ReviewEntry() {
    }

    public ReviewEntry(Map<String, Integer> scores, String comment, Instant submittedAt) {
        this.scores = scores;
        this.comment = comment;
        this.submittedAt = submittedAt;
    }

    public Map<String, Integer> getScores() {
        return scores;
    }

    public String getComment() {
        return comment;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }
}
