package ro.smarthr.evaluation;

public class CycleCriterion {

    private String key;
    private String name;
    private int weight;

    public CycleCriterion() {
    }

    public CycleCriterion(String key, String name, int weight) {
        this.key = key;
        this.name = name;
        this.weight = weight;
    }

    public String getKey() {
        return key;
    }

    public String getName() {
        return name;
    }

    public int getWeight() {
        return weight;
    }
}
